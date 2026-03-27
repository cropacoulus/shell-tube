import { createDomainEvent } from "@/lib/events/event-factory";
import { buildEventIdempotencyKey } from "@/lib/events/idempotency";
import { getEventStore } from "@/lib/repositories";
import { createOptionBConfig } from "@/lib/runtime/option-b-config";
import { buildTitleBlobName } from "@/lib/storage/blob-path";
import { createDefaultProjectionStore } from "@/lib/projection-store";

type CatalogLessonProjectionRecord = {
  lessonId: string;
  courseId: string;
  title: string;
  synopsis: string;
  durationMin: number;
  maturityRating: string;
  manifestBlobKey: string;
  streamAssetId?: string;
  processingStatus?: "idle" | "source_uploaded" | "packaging_requested" | "manifest_ready";
  publishStatus: "draft" | "published";
  createdAt: string;
  updatedAt: string;
};

export type PendingPackagingJob = {
  lessonId: string;
  courseId: string;
  sourceAssetId: string;
};

export type MediaProcessingRunResult = {
  mode: "manual-pending" | "mock-manifest";
  pendingJobs: PendingPackagingJob[];
  completedJobs: Array<{
    lessonId: string;
    courseId: string;
    manifestBlobKey: string;
  }>;
};

export type CompletePackagingInput = {
  lessonId: string;
  courseId: string;
  manifestBlobKey?: string;
  actorUserId?: string;
  source?: string;
};

export async function listPendingPackagingJobs(): Promise<PendingPackagingJob[]> {
  const projectionStore = createDefaultProjectionStore();
  const lessons =
    (await projectionStore.getJson<Record<string, CatalogLessonProjectionRecord>>(
      "stream:projection:catalog:lessons",
    )) ?? {};

  return Object.values(lessons)
    .filter(
      (lesson) =>
        lesson.processingStatus === "packaging_requested" &&
        Boolean(lesson.streamAssetId) &&
        !lesson.manifestBlobKey,
    )
    .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt))
    .map((lesson) => ({
      lessonId: lesson.lessonId,
      courseId: lesson.courseId,
      sourceAssetId: lesson.streamAssetId as string,
    }));
}

export async function completePackagingForLesson(input: CompletePackagingInput) {
  const manifestBlobKey =
    input.manifestBlobKey ||
    buildTitleBlobName({
      titleId: input.lessonId,
      folder: "manifests",
      fileName: "master.m3u8",
    });
  const manifestAssetId = `asset_manifest_${input.lessonId}`;
  const now = new Date().toISOString();

  await getEventStore().appendEvents([
    createDomainEvent({
      type: "media_asset_registered",
      aggregateType: "media_asset",
      aggregateId: manifestAssetId,
      actor: input.actorUserId ? { userId: input.actorUserId } : undefined,
      idempotencyKey: buildEventIdempotencyKey("media-processing-manifest-register", input.lessonId, manifestBlobKey),
      payload: {
        assetId: manifestAssetId,
        lessonId: input.lessonId,
        courseId: input.courseId,
        blobKey: manifestBlobKey,
        fileName: "master.m3u8",
        contentType: "application/vnd.apple.mpegurl",
        assetType: "manifest",
        storageProvider: input.source || "media-processor",
        createdAt: now,
      },
    }),
    createDomainEvent({
      type: "lesson_manifest_attached",
      aggregateType: "lesson",
      aggregateId: input.lessonId,
      actor: input.actorUserId ? { userId: input.actorUserId } : undefined,
      idempotencyKey: buildEventIdempotencyKey("media-processing-manifest-attach", input.lessonId, manifestBlobKey),
      payload: {
        lessonId: input.lessonId,
        courseId: input.courseId,
        manifestBlobKey,
        streamAssetId: manifestAssetId,
        updatedAt: now,
      },
    }),
  ]);

  return {
    lessonId: input.lessonId,
    courseId: input.courseId,
    manifestBlobKey,
  };
}

export async function runMediaProcessingBatch(limit = 20): Promise<MediaProcessingRunResult> {
  const config = createOptionBConfig();
  const pendingJobs = (await listPendingPackagingJobs()).slice(0, Math.max(1, Math.floor(limit)));

  if (config.mediaPipelineMode !== "mock-manifest") {
    return {
      mode: config.mediaPipelineMode,
      pendingJobs,
      completedJobs: [],
    };
  }

  const completedJobs: MediaProcessingRunResult["completedJobs"] = [];

  for (const job of pendingJobs) {
    completedJobs.push(
      await completePackagingForLesson({
        lessonId: job.lessonId,
        courseId: job.courseId,
        actorUserId: "system:media-processor",
        source: "mock-media-pipeline",
      }),
    );
  }

  return {
    mode: config.mediaPipelineMode,
    pendingJobs,
    completedJobs,
  };
}
