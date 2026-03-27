import { canPublishContent, canModeratePlatform } from "@/lib/auth/capabilities";
import type { FilmCourseRecord, FilmLessonRecord } from "@/lib/contracts/admin";
import { validateCreatorContentCore, validateCreatorPublishState } from "@/lib/creator/content-validation";
import type { DomainEvent } from "@/lib/events/contracts";
import { createDomainEvent } from "@/lib/events/event-factory";
import { buildEventIdempotencyKey } from "@/lib/events/idempotency";
import { runProjectionBatch } from "@/lib/jobs/projection-runner";
import { listCategoriesFromProjection } from "@/lib/projections/category-read-model";
import {
  getCreatorAdminContentItemByCourseIdFromProjection,
  listCreatorOwnedAdminContentItemsFromProjection,
} from "@/lib/projections/creator-content-read-model";
import { getContentRepository, getEventStore } from "@/lib/repositories";
import { createOptionBConfig } from "@/lib/runtime/option-b-config";
import { getAuthContextFromRequest } from "@/lib/server/auth";
import { getEffectiveUserRole } from "@/lib/server/effective-role";
import { buildAdminContentItem } from "@/lib/server/admin-content-model";
import { listCreatorOwnedAdminContentItems } from "@/lib/server/creator-content-flow";
import { jsonError, jsonOk } from "@/lib/server/http";

type CreatorContentCreateRequest = {
  title: string;
  synopsis: string;
  year?: number;
  categoryId: string;
  heroImageUrl: string;
  cardImageUrl: string;
  durationMin: number;
  maturityRating: string;
  manifestBlobKey?: string;
  streamAssetId?: string;
  publishStatus: "draft" | "published";
};

type CreatorContentPatchRequest = Partial<CreatorContentCreateRequest> & {
  courseId: string;
  lessonId: string;
};

type CreatorContentDeleteRequest = {
  courseId: string;
};

function isValidCreate(body: unknown): body is CreatorContentCreateRequest {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate.title === "string" &&
    typeof candidate.synopsis === "string" &&
    (candidate.year === undefined || typeof candidate.year === "number") &&
    typeof candidate.categoryId === "string" &&
    typeof candidate.heroImageUrl === "string" &&
    typeof candidate.cardImageUrl === "string" &&
    typeof candidate.durationMin === "number" &&
    typeof candidate.maturityRating === "string" &&
    (candidate.manifestBlobKey === undefined || typeof candidate.manifestBlobKey === "string") &&
    (candidate.streamAssetId === undefined || typeof candidate.streamAssetId === "string") &&
    (candidate.publishStatus === "draft" || candidate.publishStatus === "published")
  );
}

async function ensureCreator(req: Request) {
  const auth = getAuthContextFromRequest(req);
  if (!auth) return { ok: false as const, response: jsonError("UNAUTHORIZED", "Session is required", 401) };
  const effectiveRole = await getEffectiveUserRole({
    userId: auth.userId,
    fallbackRole: auth.role,
  });
  if (!canPublishContent(effectiveRole)) {
    return { ok: false as const, response: jsonError("FORBIDDEN", "Creator or admin access required", 403) };
  }
  return {
    ok: true as const,
    auth: {
      ...auth,
      role: effectiveRole,
    },
  };
}

async function canManageCourse(input: { courseId: string; profileId: string; role: "student" | "creator" | "admin" }) {
  if (createOptionBConfig().projectionStoreBackend === "upstash") {
    const item = await getCreatorAdminContentItemByCourseIdFromProjection(input.courseId);
    if (!item) return null;
    if (canModeratePlatform(input.role)) return item;
    return item.creatorProfileId === input.profileId ? item : null;
  }

  const course = await getContentRepository().getCourseRecordById(input.courseId);
  if (!course) return null;
  if (canModeratePlatform(input.role)) return course;
  return course.creatorProfileId === input.profileId ? course : null;
}

export async function GET(req: Request) {
  const gate = await ensureCreator(req);
  if (!gate.ok) return gate.response;
  const optionB = createOptionBConfig();
  if (optionB.projectionStoreBackend === "upstash") {
    return jsonOk(
      await listCreatorOwnedAdminContentItemsFromProjection({
        profileId: gate.auth.profileId,
        role: gate.auth.role,
      }),
    );
  }
  return jsonOk(
    await listCreatorOwnedAdminContentItems({
      profileId: gate.auth.profileId,
      role: gate.auth.role,
    }),
  );
}

export async function POST(req: Request) {
  const gate = await ensureCreator(req);
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => null)) as unknown;
  if (!isValidCreate(body)) return jsonError("INVALID_REQUEST", "Invalid creator content payload", 422);
  const contentValidationError = validateCreatorContentCore(body);
  if (contentValidationError) {
    return jsonError("INVALID_REQUEST", contentValidationError, 422);
  }
  const publishStateError = validateCreatorPublishState({
    publishStatus: body.publishStatus,
    manifestBlobKey: body.manifestBlobKey,
  });
  if (publishStateError) {
    return jsonError("INVALID_REQUEST", publishStateError, 422);
  }

  const repository = getContentRepository();
  const optionB = createOptionBConfig();
  const categories = optionB.projectionStoreBackend === "upstash"
    ? await listCategoriesFromProjection()
    : await repository.listCategories();
  if (!categories.find((item) => item.id === body.categoryId)) {
    return jsonError("INVALID_REQUEST", "categoryId does not exist", 422);
  }

  const createdAt = new Date().toISOString();
  const courseYear = typeof body.year === "number" ? body.year : new Date().getFullYear();
  const course: FilmCourseRecord = optionB.projectionStoreBackend === "upstash"
    ? {
        id: `course_${crypto.randomUUID().slice(0, 12)}`,
        creatorProfileId: gate.auth.profileId,
        title: body.title,
        synopsis: body.synopsis,
        year: courseYear,
        categoryId: body.categoryId,
        heroImageUrl: body.heroImageUrl,
        cardImageUrl: body.cardImageUrl,
        publishStatus: body.publishStatus,
        createdAt,
      }
    : await repository.addCourseRecord({
        creatorProfileId: gate.auth.profileId,
        title: body.title,
        synopsis: body.synopsis,
        year: courseYear,
        categoryId: body.categoryId,
        heroImageUrl: body.heroImageUrl,
        cardImageUrl: body.cardImageUrl,
        publishStatus: body.publishStatus,
      });
  const lesson: FilmLessonRecord = optionB.projectionStoreBackend === "upstash"
    ? {
        id: `lesson_${crypto.randomUUID().slice(0, 12)}`,
        courseId: course.id,
        title: `${body.title} • Main Lesson`,
        synopsis: body.synopsis,
        durationMin: body.durationMin,
        maturityRating: body.maturityRating,
        manifestBlobKey: body.manifestBlobKey ?? "",
        streamAssetId: body.streamAssetId,
        publishStatus: body.publishStatus,
        createdAt,
      }
    : await repository.addLessonRecord({
        courseId: course.id,
        title: `${body.title} • Main Lesson`,
        synopsis: body.synopsis,
        durationMin: body.durationMin,
        maturityRating: body.maturityRating,
        manifestBlobKey: body.manifestBlobKey ?? "",
        streamAssetId: body.streamAssetId,
        publishStatus: body.publishStatus,
      });

  const events: DomainEvent[] = [
    createDomainEvent({
      type: "course_created",
      aggregateType: "course",
      aggregateId: course.id,
      actor: {
        userId: gate.auth.userId,
        role: gate.auth.role,
      },
      idempotencyKey: buildEventIdempotencyKey("creator-content-course-create", course.id),
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
      actor: {
        userId: gate.auth.userId,
        role: gate.auth.role,
      },
      idempotencyKey: buildEventIdempotencyKey("creator-content-lesson-create", lesson.id),
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
  ];

  await getEventStore().appendEvents(events);
  await runProjectionBatch(200);

  return jsonOk(buildAdminContentItem(course, lesson), 201);
}

export async function PATCH(req: Request) {
  const gate = await ensureCreator(req);
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => null)) as CreatorContentPatchRequest | null;
  if (!body || typeof body.courseId !== "string" || typeof body.lessonId !== "string") {
    return jsonError("INVALID_REQUEST", "courseId and lessonId are required", 422);
  }

  const managedCourse = await canManageCourse({
    courseId: body.courseId,
    profileId: gate.auth.profileId,
    role: gate.auth.role,
  });
  if (!managedCourse) return jsonError("FORBIDDEN", "You do not own this course", 403);
  const optionB = createOptionBConfig();
  const existingLesson = optionB.projectionStoreBackend === "upstash"
    ? await getCreatorAdminContentItemByCourseIdFromProjection(body.courseId)
    : await getContentRepository().getLessonRecordById(body.lessonId);

  if (typeof body.categoryId === "string") {
    const categories = optionB.projectionStoreBackend === "upstash"
      ? await listCategoriesFromProjection()
      : await getContentRepository().listCategories();
    if (!categories.find((item) => item.id === body.categoryId)) {
      return jsonError("INVALID_REQUEST", "categoryId does not exist", 422);
    }
  }
  const publishStateError = validateCreatorPublishState({
    publishStatus: body.publishStatus ?? managedCourse.publishStatus,
    manifestBlobKey: typeof body.manifestBlobKey === "string" ? body.manifestBlobKey : undefined,
  });
  if (publishStateError && typeof body.manifestBlobKey === "string") {
    return jsonError("INVALID_REQUEST", publishStateError, 422);
  }
  if (
    publishStateError &&
    body.publishStatus === "published"
  ) {
    if (!existingLesson?.manifestBlobKey.trim()) {
      return jsonError("INVALID_REQUEST", publishStateError, 422);
    }
  }

  const repository = getContentRepository();
  const updatedAt = new Date().toISOString();
  const updatedCourse: FilmCourseRecord | null = optionB.projectionStoreBackend === "upstash"
    ? {
        id: body.courseId,
        creatorProfileId: managedCourse.creatorProfileId,
        title: typeof body.title === "string" ? body.title : managedCourse.title,
        synopsis: typeof body.synopsis === "string" ? body.synopsis : managedCourse.synopsis,
        year: typeof body.year === "number" ? body.year : managedCourse.year,
        categoryId: typeof body.categoryId === "string" ? body.categoryId : managedCourse.categoryId,
        heroImageUrl: typeof body.heroImageUrl === "string" ? body.heroImageUrl : managedCourse.heroImageUrl,
        cardImageUrl: typeof body.cardImageUrl === "string" ? body.cardImageUrl : managedCourse.cardImageUrl,
        publishStatus: body.publishStatus ?? managedCourse.publishStatus,
        createdAt: managedCourse.createdAt,
      }
    : await repository.updateCourseRecord(body.courseId, {
        ...(typeof body.title === "string" ? { title: body.title } : {}),
        ...(typeof body.synopsis === "string" ? { synopsis: body.synopsis } : {}),
        ...(typeof body.year === "number" ? { year: body.year } : {}),
        ...(typeof body.categoryId === "string" ? { categoryId: body.categoryId } : {}),
        ...(typeof body.heroImageUrl === "string" ? { heroImageUrl: body.heroImageUrl } : {}),
        ...(typeof body.cardImageUrl === "string" ? { cardImageUrl: body.cardImageUrl } : {}),
        ...(body.publishStatus ? { publishStatus: body.publishStatus } : {}),
      });
  const updatedLesson: FilmLessonRecord | null = optionB.projectionStoreBackend === "upstash"
    ? {
        id: body.lessonId,
        courseId: body.courseId,
        title: typeof body.title === "string" ? `${body.title} • Main Lesson` : existingLesson?.title ?? "",
        synopsis: typeof body.synopsis === "string" ? body.synopsis : existingLesson?.synopsis ?? "",
        durationMin: typeof body.durationMin === "number" ? body.durationMin : existingLesson?.durationMin ?? 0,
        maturityRating: typeof body.maturityRating === "string" ? body.maturityRating : existingLesson?.maturityRating ?? "",
        manifestBlobKey:
          typeof body.manifestBlobKey === "string" ? body.manifestBlobKey : existingLesson?.manifestBlobKey ?? "",
        streamAssetId: typeof body.streamAssetId === "string" ? body.streamAssetId : existingLesson?.streamAssetId,
        processingStatus: existingLesson?.processingStatus,
        publishStatus: body.publishStatus ?? existingLesson?.publishStatus ?? "draft",
        createdAt: existingLesson?.createdAt ?? managedCourse.createdAt,
      }
    : await repository.updateLessonRecord(body.lessonId, {
        ...(typeof body.title === "string" ? { title: `${body.title} • Main Lesson` } : {}),
        ...(typeof body.synopsis === "string" ? { synopsis: body.synopsis } : {}),
        ...(typeof body.durationMin === "number" ? { durationMin: body.durationMin } : {}),
        ...(typeof body.maturityRating === "string" ? { maturityRating: body.maturityRating } : {}),
        ...(typeof body.manifestBlobKey === "string" ? { manifestBlobKey: body.manifestBlobKey } : {}),
        ...(typeof body.streamAssetId === "string" ? { streamAssetId: body.streamAssetId } : {}),
        ...(body.publishStatus ? { publishStatus: body.publishStatus } : {}),
      });

  if (!updatedCourse || !updatedLesson) {
    return jsonError("NOT_FOUND", "Creator content not found", 404);
  }

  const events: DomainEvent[] = [
    createDomainEvent({
      type: "course_updated",
      aggregateType: "course",
      aggregateId: updatedCourse.id,
      actor: {
        userId: gate.auth.userId,
        role: gate.auth.role,
      },
      idempotencyKey: buildEventIdempotencyKey("creator-content-course-update", updatedCourse.id, updatedCourse.publishStatus),
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
      actor: {
        userId: gate.auth.userId,
        role: gate.auth.role,
      },
      idempotencyKey: buildEventIdempotencyKey("creator-content-lesson-update", updatedLesson.id, updatedLesson.publishStatus),
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
  ];

  if (existingLesson && existingLesson.publishStatus !== updatedLesson.publishStatus) {
    events.push(
      createDomainEvent({
        type: updatedLesson.publishStatus === "published" ? "lesson_published" : "lesson_unpublished",
        aggregateType: "lesson",
        aggregateId: updatedLesson.id,
        actor: {
          userId: gate.auth.userId,
          role: gate.auth.role,
        },
        idempotencyKey: buildEventIdempotencyKey("creator-content-lesson-publish-toggle", updatedLesson.id, updatedLesson.publishStatus),
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
    );
  }

  await getEventStore().appendEvents(events);
  await runProjectionBatch(200);
  return jsonOk(buildAdminContentItem(updatedCourse, updatedLesson));
}

export async function DELETE(req: Request) {
  const gate = await ensureCreator(req);
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => null)) as CreatorContentDeleteRequest | null;
  if (!body || typeof body.courseId !== "string") {
    return jsonError("INVALID_REQUEST", "courseId is required", 422);
  }

  const managedCourse = await canManageCourse({
    courseId: body.courseId,
    profileId: gate.auth.profileId,
    role: gate.auth.role,
  });
  if (!managedCourse) return jsonError("FORBIDDEN", "You do not own this course", 403);

  const optionB = createOptionBConfig();
  if (optionB.projectionStoreBackend !== "upstash") {
    const deleted = await getContentRepository().deleteCourseRecord(body.courseId);
    if (!deleted) return jsonError("NOT_FOUND", "Creator content not found", 404);
  }
  await getEventStore().appendEvent(
    createDomainEvent({
      type: "course_deleted",
      aggregateType: "course",
      aggregateId: body.courseId,
      actor: {
        userId: gate.auth.userId,
        role: gate.auth.role,
      },
      idempotencyKey: buildEventIdempotencyKey("creator-content-course-delete", body.courseId),
      payload: {
        courseId: body.courseId,
      },
    }),
  );
  await runProjectionBatch(200);
  return jsonOk({ deleted: true });
}
