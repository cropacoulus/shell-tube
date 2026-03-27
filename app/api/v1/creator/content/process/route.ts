import { canModeratePlatform, canPublishContent } from "@/lib/auth/capabilities";
import { createDomainEvent } from "@/lib/events/event-factory";
import { buildEventIdempotencyKey } from "@/lib/events/idempotency";
import { runProjectionBatch } from "@/lib/jobs/projection-runner";
import { getCreatorAdminContentItemByCourseIdFromProjection } from "@/lib/projections/creator-content-read-model";
import { getContentRepository, getEventStore } from "@/lib/repositories";
import { createOptionBConfig } from "@/lib/runtime/option-b-config";
import { getAuthContextFromRequest } from "@/lib/server/auth";
import { getEffectiveUserRole } from "@/lib/server/effective-role";
import { jsonError, jsonOk } from "@/lib/server/http";

type ProcessRequest = {
  courseId: string;
  lessonId: string;
};

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

export async function POST(req: Request) {
  const gate = await ensureCreator(req);
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => null)) as ProcessRequest | null;
  if (!body?.courseId || !body?.lessonId) {
    return jsonError("INVALID_REQUEST", "courseId and lessonId are required", 422);
  }

  const optionB = createOptionBConfig();
  const item = optionB.projectionStoreBackend === "upstash"
    ? await getCreatorAdminContentItemByCourseIdFromProjection(body.courseId)
    : null;
  const lesson = optionB.projectionStoreBackend === "upstash"
    ? item
    : await getContentRepository().getLessonRecordById(body.lessonId);
  const course = optionB.projectionStoreBackend === "upstash"
    ? item
    : await getContentRepository().getCourseRecordById(body.courseId);

  if (!lesson || !course) {
    return jsonError("NOT_FOUND", "Course draft was not found", 404);
  }

  if (!canModeratePlatform(gate.auth.role) && course.creatorProfileId !== gate.auth.profileId) {
    return jsonError("FORBIDDEN", "You do not own this course", 403);
  }
  if (!lesson.streamAssetId) {
    return jsonError("INVALID_REQUEST", "Upload a source video before requesting packaging.", 422);
  }
  if (lesson.manifestBlobKey) {
    return jsonError("INVALID_REQUEST", "This lesson already has a manifest and does not need packaging.", 422);
  }

  const updatedAt = new Date().toISOString();
  await getEventStore().appendEvent(
    createDomainEvent({
      type: "lesson_processing_requested",
      aggregateType: "lesson",
      aggregateId: body.lessonId,
      actor: {
        userId: gate.auth.userId,
        role: gate.auth.role,
      },
      idempotencyKey: buildEventIdempotencyKey("lesson-processing-request", body.lessonId, updatedAt),
      payload: {
        lessonId: body.lessonId,
        courseId: body.courseId,
        updatedAt,
      },
    }),
  );
  await runProjectionBatch(200);

  return jsonOk({
    lessonId: body.lessonId,
    courseId: body.courseId,
    processingStatus: "packaging_requested",
    updatedAt,
  });
}
