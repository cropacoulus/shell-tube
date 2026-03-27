import { requireAdmin } from "@/lib/blockchain/role-registry";
import { getAuthContextFromRequestOrBearer } from "@/lib/server/auth";
import type { FilmCourseRecord, FilmLessonRecord, VideoPublishStatus } from "@/lib/contracts/admin";
import { createDomainEvent } from "@/lib/events/event-factory";
import { buildEventIdempotencyKey } from "@/lib/events/idempotency";
import { runProjectionBatch } from "@/lib/jobs/projection-runner";
import { listCategoriesFromProjection } from "@/lib/projections/category-read-model";
import {
  getCreatorAdminContentItemByCourseIdFromProjection,
  listCreatorOwnedAdminContentItemsFromProjection,
} from "@/lib/projections/creator-content-read-model";
import { createOptionBConfig } from "@/lib/runtime/option-b-config";
import { jsonError, jsonOk } from "@/lib/server/http";
import { buildAdminContentItem } from "@/lib/server/admin-content-model";
import { getContentRepository, getEventStore } from "@/lib/repositories";
import { requireWalletActionProof } from "@/lib/server/wallet-action-auth";

type VideoCreateRequest = {
  title: string;
  synopsis: string;
  year: number;
  maturityRating: string;
  durationMin: number;
  categoryId: string;
  heroImageUrl: string;
  cardImageUrl: string;
  manifestBlobKey: string;
  streamAssetId?: string;
  publishStatus?: VideoPublishStatus;
};

type VideoPatchRequest = {
  id: string;
  title?: string;
  synopsis?: string;
  year?: number;
  maturityRating?: string;
  durationMin?: number;
  categoryId?: string;
  heroImageUrl?: string;
  cardImageUrl?: string;
  manifestBlobKey?: string;
  streamAssetId?: string;
  publishStatus?: VideoPublishStatus;
};

type VideoDeleteRequest = {
  id: string;
};

function isValid(body: unknown): body is VideoCreateRequest {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate.title === "string" &&
    typeof candidate.synopsis === "string" &&
    typeof candidate.year === "number" &&
    typeof candidate.maturityRating === "string" &&
    typeof candidate.durationMin === "number" &&
    typeof candidate.categoryId === "string" &&
    typeof candidate.heroImageUrl === "string" &&
    typeof candidate.cardImageUrl === "string" &&
    typeof candidate.manifestBlobKey === "string" &&
    (candidate.streamAssetId === undefined || typeof candidate.streamAssetId === "string") &&
    (candidate.publishStatus === undefined ||
      candidate.publishStatus === "draft" ||
      candidate.publishStatus === "published")
  );
}

async function ensureAdmin(req: Request) {
  const auth = await getAuthContextFromRequestOrBearer(req);
  if (!auth) return { ok: false as const, response: jsonError("UNAUTHORIZED", "Session is required", 401) };
  try {
    await requireAdmin(auth.userId);
  } catch {
    return { ok: false as const, response: jsonError("FORBIDDEN", "Admin access required", 403) };
  }
  return { ok: true as const, auth };
}

export async function GET(req: Request) {
  const gate = await ensureAdmin(req);
  if (!gate.ok) return gate.response;
  const optionB = createOptionBConfig();
  if (optionB.projectionStoreBackend === "upstash") {
    return jsonOk(
      await listCreatorOwnedAdminContentItemsFromProjection({
        profileId: gate.auth.profileId,
        role: "admin",
      }),
    );
  }
  const repository = getContentRepository();
  const [courses, lessons] = await Promise.all([
    repository.listCourseRecords(),
    repository.listLessonRecords(),
  ]);
  const items = courses
    .map((course) => {
      const lesson = lessons.find((item) => item.courseId === course.id);
      return lesson ? buildAdminContentItem(course, lesson) : null;
    })
    .filter((item): item is ReturnType<typeof buildAdminContentItem> => Boolean(item));
  return jsonOk(items);
}

export async function POST(req: Request) {
  const gate = await ensureAdmin(req);
  if (!gate.ok) return gate.response;
  const proof = await requireWalletActionProof(req, gate.auth.userId);
  if (!proof.ok) return proof.response;

  const body = (await req.json().catch(() => null)) as unknown;
  if (!isValid(body)) return jsonError("INVALID_REQUEST", "Invalid video payload", 422);

  const optionB = createOptionBConfig();
  const repository = getContentRepository();
  const categories = optionB.projectionStoreBackend === "upstash"
    ? await listCategoriesFromProjection()
    : await repository.listCategories();
  if (!categories.find((item) => item.id === body.categoryId)) {
    return jsonError("INVALID_REQUEST", "categoryId does not exist", 422);
  }
  if (!body.manifestBlobKey.trim()) {
    return jsonError(
      "INVALID_REQUEST",
      "Stream blob key is required. Upload video or manifest to Verra first.",
      422,
    );
  }

  const createdAt = new Date().toISOString();
  const course: FilmCourseRecord = optionB.projectionStoreBackend === "upstash"
    ? {
        id: `course_${crypto.randomUUID().slice(0, 12)}`,
        title: body.title,
        synopsis: body.synopsis,
        year: body.year,
        categoryId: body.categoryId,
        heroImageUrl: body.heroImageUrl,
        cardImageUrl: body.cardImageUrl,
        publishStatus: body.publishStatus ?? "draft",
        createdAt,
      }
    : await repository.addCourseRecord({
        title: body.title,
        synopsis: body.synopsis,
        year: body.year,
        categoryId: body.categoryId,
        heroImageUrl: body.heroImageUrl,
        cardImageUrl: body.cardImageUrl,
        publishStatus: body.publishStatus ?? "draft",
      });
  const lesson: FilmLessonRecord = optionB.projectionStoreBackend === "upstash"
    ? {
        id: `lesson_${crypto.randomUUID().slice(0, 12)}`,
        courseId: course.id,
        title: `${body.title} • Main Lesson`,
        synopsis: body.synopsis,
        durationMin: body.durationMin,
        maturityRating: body.maturityRating,
        manifestBlobKey: body.manifestBlobKey,
        streamAssetId: body.streamAssetId,
        publishStatus: body.publishStatus ?? "draft",
        createdAt,
      }
    : await repository.addLessonRecord({
        courseId: course.id,
        title: `${body.title} • Main Lesson`,
        synopsis: body.synopsis,
        durationMin: body.durationMin,
        maturityRating: body.maturityRating,
        manifestBlobKey: body.manifestBlobKey,
        streamAssetId: body.streamAssetId,
        publishStatus: body.publishStatus ?? "draft",
      });
  await getEventStore().appendEvents([
    createDomainEvent({
      type: "course_created",
      aggregateType: "course",
      aggregateId: course.id,
      actor: { userId: gate.auth.userId, role: gate.auth.role },
      idempotencyKey: buildEventIdempotencyKey("admin-video-course-create", course.id),
      payload: {
        courseId: course.id,
        creatorProfileId: course.creatorProfileId,
        title: course.title,
        synopsis: course.synopsis,
        year: course.year,
        categoryId: course.categoryId,
        heroImageUrl: course.heroImageUrl,
        cardImageUrl: course.cardImageUrl,
        publishStatus: course.publishStatus,
        createdAt: course.createdAt,
        updatedAt: course.createdAt,
      },
    }),
    createDomainEvent({
      type: "lesson_created",
      aggregateType: "lesson",
      aggregateId: lesson.id,
      actor: { userId: gate.auth.userId, role: gate.auth.role },
      idempotencyKey: buildEventIdempotencyKey("admin-video-lesson-create", lesson.id),
      payload: {
        lessonId: lesson.id,
        courseId: lesson.courseId,
        title: lesson.title,
        synopsis: lesson.synopsis,
        durationMin: lesson.durationMin,
        maturityRating: lesson.maturityRating,
        manifestBlobKey: lesson.manifestBlobKey,
        streamAssetId: lesson.streamAssetId,
        processingStatus: lesson.processingStatus,
        publishStatus: lesson.publishStatus,
        createdAt: lesson.createdAt,
        updatedAt: lesson.createdAt,
      },
    }),
  ]);
  await runProjectionBatch(200);
  return jsonOk(buildAdminContentItem(course, lesson), 201);
}

export async function PATCH(req: Request) {
  const gate = await ensureAdmin(req);
  if (!gate.ok) return gate.response;
  const proof = await requireWalletActionProof(req, gate.auth.userId);
  if (!proof.ok) return proof.response;

  const body = (await req.json().catch(() => null)) as VideoPatchRequest | null;
  if (!body || typeof body.id !== "string") {
    return jsonError("INVALID_REQUEST", "Video id is required", 422);
  }

  const patch: Omit<VideoPatchRequest, "id"> = {};
  if (typeof body.title === "string") patch.title = body.title;
  if (typeof body.synopsis === "string") patch.synopsis = body.synopsis;
  if (typeof body.year === "number") patch.year = body.year;
  if (typeof body.maturityRating === "string") patch.maturityRating = body.maturityRating;
  if (typeof body.durationMin === "number") patch.durationMin = body.durationMin;
  if (typeof body.categoryId === "string") patch.categoryId = body.categoryId;
  if (typeof body.heroImageUrl === "string") patch.heroImageUrl = body.heroImageUrl;
  if (typeof body.cardImageUrl === "string") patch.cardImageUrl = body.cardImageUrl;
  if (typeof body.manifestBlobKey === "string") patch.manifestBlobKey = body.manifestBlobKey;
  if (typeof body.streamAssetId === "string") patch.streamAssetId = body.streamAssetId;
  if (body.publishStatus === "draft" || body.publishStatus === "published") {
    patch.publishStatus = body.publishStatus;
  }

  if (Object.keys(patch).length === 0) {
    return jsonError("INVALID_REQUEST", "At least one field must be updated", 422);
  }

  const optionB = createOptionBConfig();
  if (typeof patch.categoryId === "string") {
    const categories = optionB.projectionStoreBackend === "upstash"
      ? await listCategoriesFromProjection()
      : await getContentRepository().listCategories();
    if (!categories.find((item) => item.id === patch.categoryId)) {
      return jsonError("INVALID_REQUEST", "categoryId does not exist", 422);
    }
  }
  if (typeof patch.manifestBlobKey === "string" && !patch.manifestBlobKey.trim()) {
    return jsonError("INVALID_REQUEST", "Stream blob key cannot be empty", 422);
  }

  const repository = getContentRepository();
  const existing = optionB.projectionStoreBackend === "upstash"
    ? await getCreatorAdminContentItemByCourseIdFromProjection(body.id)
    : null;
  const lesson = optionB.projectionStoreBackend === "upstash"
    ? existing
      ? { id: existing.lessonId }
      : null
    : (await repository.listLessonRecordsByCourse(body.id))[0];
  if (!lesson) return jsonError("NOT_FOUND", "Video not found", 404);

  const updatedAt = new Date().toISOString();
  const [updatedCourse, updatedLesson] = optionB.projectionStoreBackend === "upstash"
    ? [
        existing
          ? ({
              id: body.id,
              creatorProfileId: existing.creatorProfileId,
              title: typeof patch.title === "string" ? patch.title : existing.title,
              synopsis: typeof patch.synopsis === "string" ? patch.synopsis : existing.synopsis,
              year: typeof patch.year === "number" ? patch.year : existing.year,
              categoryId: typeof patch.categoryId === "string" ? patch.categoryId : existing.categoryId,
              heroImageUrl: typeof patch.heroImageUrl === "string" ? patch.heroImageUrl : existing.heroImageUrl,
              cardImageUrl: typeof patch.cardImageUrl === "string" ? patch.cardImageUrl : existing.cardImageUrl,
              publishStatus: patch.publishStatus ?? existing.publishStatus,
              createdAt: existing.createdAt,
            } as FilmCourseRecord)
          : null,
        existing
          ? ({
              id: existing.lessonId,
              courseId: body.id,
              title: typeof patch.title === "string" ? `${patch.title} • Main Lesson` : `${existing.title} • Main Lesson`,
              synopsis: typeof patch.synopsis === "string" ? patch.synopsis : existing.synopsis,
              durationMin: typeof patch.durationMin === "number" ? patch.durationMin : existing.durationMin,
              maturityRating: typeof patch.maturityRating === "string" ? patch.maturityRating : existing.maturityRating,
              manifestBlobKey:
                typeof patch.manifestBlobKey === "string" ? patch.manifestBlobKey : existing.manifestBlobKey,
              streamAssetId: typeof patch.streamAssetId === "string" ? patch.streamAssetId : existing.streamAssetId,
              processingStatus: existing.processingStatus,
              publishStatus: patch.publishStatus ?? existing.publishStatus,
              createdAt: existing.createdAt,
            } as FilmLessonRecord)
          : null,
      ]
    : await Promise.all([
        repository.updateCourseRecord(body.id, {
          ...(typeof patch.title === "string" ? { title: patch.title } : {}),
          ...(typeof patch.synopsis === "string" ? { synopsis: patch.synopsis } : {}),
          ...(typeof patch.year === "number" ? { year: patch.year } : {}),
          ...(typeof patch.categoryId === "string" ? { categoryId: patch.categoryId } : {}),
          ...(typeof patch.heroImageUrl === "string" ? { heroImageUrl: patch.heroImageUrl } : {}),
          ...(typeof patch.cardImageUrl === "string" ? { cardImageUrl: patch.cardImageUrl } : {}),
          ...(patch.publishStatus ? { publishStatus: patch.publishStatus } : {}),
        }),
        repository.updateLessonRecord(lesson.id, {
          ...(typeof patch.title === "string" ? { title: `${patch.title} • Main Lesson` } : {}),
          ...(typeof patch.synopsis === "string" ? { synopsis: patch.synopsis } : {}),
          ...(typeof patch.durationMin === "number" ? { durationMin: patch.durationMin } : {}),
          ...(typeof patch.maturityRating === "string" ? { maturityRating: patch.maturityRating } : {}),
          ...(typeof patch.manifestBlobKey === "string" ? { manifestBlobKey: patch.manifestBlobKey } : {}),
          ...(typeof patch.streamAssetId === "string" ? { streamAssetId: patch.streamAssetId } : {}),
          ...(patch.publishStatus ? { publishStatus: patch.publishStatus } : {}),
        }),
      ]);
  if (!updatedCourse || !updatedLesson) return jsonError("NOT_FOUND", "Video not found", 404);
  await getEventStore().appendEvents([
    createDomainEvent({
      type: "course_updated",
      aggregateType: "course",
      aggregateId: updatedCourse.id,
      actor: { userId: gate.auth.userId, role: gate.auth.role },
      idempotencyKey: buildEventIdempotencyKey("admin-video-course-update", updatedCourse.id, updatedAt),
      payload: {
        courseId: updatedCourse.id,
        creatorProfileId: updatedCourse.creatorProfileId,
        title: updatedCourse.title,
        synopsis: updatedCourse.synopsis,
        year: updatedCourse.year,
        categoryId: updatedCourse.categoryId,
        heroImageUrl: updatedCourse.heroImageUrl,
        cardImageUrl: updatedCourse.cardImageUrl,
        publishStatus: updatedCourse.publishStatus,
        createdAt: updatedCourse.createdAt,
        updatedAt,
      },
    }),
    createDomainEvent({
      type: "lesson_updated",
      aggregateType: "lesson",
      aggregateId: updatedLesson.id,
      actor: { userId: gate.auth.userId, role: gate.auth.role },
      idempotencyKey: buildEventIdempotencyKey("admin-video-lesson-update", updatedLesson.id, updatedAt),
      payload: {
        lessonId: updatedLesson.id,
        courseId: updatedLesson.courseId,
        title: updatedLesson.title,
        synopsis: updatedLesson.synopsis,
        durationMin: updatedLesson.durationMin,
        maturityRating: updatedLesson.maturityRating,
        manifestBlobKey: updatedLesson.manifestBlobKey,
        streamAssetId: updatedLesson.streamAssetId,
        processingStatus: updatedLesson.processingStatus,
        publishStatus: updatedLesson.publishStatus,
        createdAt: updatedLesson.createdAt,
        updatedAt,
      },
    }),
  ]);
  await runProjectionBatch(200);
  return jsonOk(buildAdminContentItem(updatedCourse, updatedLesson));
}

export async function DELETE(req: Request) {
  const gate = await ensureAdmin(req);
  if (!gate.ok) return gate.response;
  const proof = await requireWalletActionProof(req, gate.auth.userId);
  if (!proof.ok) return proof.response;

  const body = (await req.json().catch(() => null)) as VideoDeleteRequest | null;
  if (!body || typeof body.id !== "string") {
    return jsonError("INVALID_REQUEST", "Video id is required", 422);
  }

  const optionB = createOptionBConfig();
  if (optionB.projectionStoreBackend !== "upstash") {
    const deleted = await getContentRepository().deleteCourseRecord(body.id);
    if (!deleted) return jsonError("NOT_FOUND", "Video not found", 404);
  }
  await getEventStore().appendEvent(
    createDomainEvent({
      type: "course_deleted",
      aggregateType: "course",
      aggregateId: body.id,
      actor: { userId: gate.auth.userId, role: gate.auth.role },
      idempotencyKey: buildEventIdempotencyKey("admin-video-delete", body.id),
      payload: { courseId: body.id },
    }),
  );
  await runProjectionBatch(200);
  return jsonOk({ deleted: true });
}
