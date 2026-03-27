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

export async function getPublishedLessonFromProjection(lessonId: string) {
  const lesson = await getLessonFromProjection(lessonId);
  if (!lesson || lesson.publishStatus !== "published") return null;
  return lesson;
}

export async function getLessonFromProjection(lessonId: string) {
  const projectionStore = createDefaultProjectionStore();
  const lessons =
    (await projectionStore.getJson<Record<string, CatalogLessonProjectionRecord>>(
      "stream:projection:catalog:lessons",
    )) ?? {};
  const lesson = lessons[lessonId];
  if (!lesson) return null;
  return {
    id: lesson.lessonId,
    courseId: lesson.courseId,
    manifestBlobKey: lesson.manifestBlobKey,
    publishStatus: lesson.publishStatus,
    title: lesson.title,
    synopsis: lesson.synopsis,
    durationMin: lesson.durationMin,
    streamAssetId: lesson.streamAssetId,
    processingStatus: lesson.processingStatus,
  };
}
