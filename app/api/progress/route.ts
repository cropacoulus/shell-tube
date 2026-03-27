import { getAuthContextFromRequest } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import type { LessonProgressRecord } from "@/lib/contracts/activity";
import type { DomainEvent } from "@/lib/events/contracts";
import { createDomainEvent } from "@/lib/events/event-factory";
import { buildEventIdempotencyKey } from "@/lib/events/idempotency";
import { runProjectionBatch } from "@/lib/jobs/projection-runner";
import { getPublishedLessonFromProjection } from "@/lib/projections/lesson-read-model";
import {
  getLessonProgressByUserAndLessonFromProjection,
  listLessonProgressByUserFromProjection,
} from "@/lib/projections/progress-read-model";
import { getActivityRepository, getContentRepository, getEventStore } from "@/lib/repositories";
import { createOptionBConfig } from "@/lib/runtime/option-b-config";

type ProgressWriteRequest = {
  lessonId: string;
  progressPercent: number;
  lastPositionSec: number;
};

export async function GET(req: Request) {
  const auth = getAuthContextFromRequest(req);
  if (!auth) return jsonError("UNAUTHORIZED", "Session is required", 401);
  const optionB = createOptionBConfig();
  const items = optionB.projectionStoreBackend === "upstash"
    ? await listLessonProgressByUserFromProjection(auth.userId)
    : await getActivityRepository().listLessonProgressByUser(auth.userId);
  return jsonOk({
    userId: auth.userId,
    items,
  });
}

function isValidRequest(body: unknown): body is ProgressWriteRequest {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate.lessonId === "string" &&
    typeof candidate.progressPercent === "number" &&
    typeof candidate.lastPositionSec === "number"
  );
}

export async function POST(req: Request) {
  const auth = getAuthContextFromRequest(req);
  if (!auth) return jsonError("UNAUTHORIZED", "Session is required", 401);

  const body = (await req.json().catch(() => null)) as unknown;
  if (!isValidRequest(body)) {
    return jsonError("INVALID_REQUEST", "Malformed progress payload", 422);
  }

  const optionB = createOptionBConfig();
  const lesson = optionB.projectionStoreBackend === "upstash"
    ? await getPublishedLessonFromProjection(body.lessonId)
    : await getContentRepository().getLessonRecordById(body.lessonId);
  if (!lesson) {
    return jsonError("NOT_FOUND", "Lesson not found", 404);
  }

  const progressPercent = Math.min(100, Math.max(0, Math.round(body.progressPercent)));
  const completedAt = progressPercent >= 100 ? new Date().toISOString() : undefined;
  let record: LessonProgressRecord;

  if (optionB.projectionStoreBackend === "upstash") {
    const existing = await getLessonProgressByUserAndLessonFromProjection(auth.userId, lesson.id);
    record = {
      id: existing?.id ?? `progress_${crypto.randomUUID().slice(0, 12)}`,
      userId: auth.userId,
      profileId: auth.profileId,
      lessonId: lesson.id,
      courseId: lesson.courseId,
      progressPercent,
      lastPositionSec: Math.max(0, Math.round(body.lastPositionSec)),
      completedAt: completedAt ?? existing?.completedAt,
      updatedAt: new Date().toISOString(),
    };
  } else {
    record = await getActivityRepository().upsertLessonProgress({
      userId: auth.userId,
      profileId: auth.profileId,
      lessonId: lesson.id,
      courseId: lesson.courseId,
      progressPercent,
      lastPositionSec: Math.max(0, Math.round(body.lastPositionSec)),
      ...(completedAt ? { completedAt } : {}),
    });

    await getActivityRepository().upsertCourseEnrollment({
      userId: auth.userId,
      profileId: auth.profileId,
      courseId: lesson.courseId,
      source: "manual",
      active: true,
    });
  }

  const events: DomainEvent[] = [
    createDomainEvent({
      type: "progress_checkpoint_recorded",
      aggregateType: "progress",
      aggregateId: record.id,
      actor: {
        userId: auth.userId,
        role: auth.role,
      },
      idempotencyKey: buildEventIdempotencyKey("progress-checkpoint", auth.userId, lesson.id, record.updatedAt),
      payload: {
        progressId: record.id,
        userId: auth.userId,
        profileId: auth.profileId,
        lessonId: lesson.id,
        courseId: lesson.courseId,
        progressPercent: record.progressPercent,
        lastPositionSec: record.lastPositionSec,
        completedAt: record.completedAt,
        updatedAt: record.updatedAt,
      },
    }),
  ];

  if (record.completedAt) {
    events.push(
      createDomainEvent({
        type: "lesson_completed",
        aggregateType: "progress",
        aggregateId: record.id,
        actor: {
          userId: auth.userId,
          role: auth.role,
        },
        idempotencyKey: buildEventIdempotencyKey("lesson-completed", auth.userId, lesson.id),
        payload: {
          progressId: record.id,
          userId: auth.userId,
          profileId: auth.profileId,
          lessonId: lesson.id,
          courseId: lesson.courseId,
          completedAt: record.completedAt,
        },
      }),
    );
  }

  await getEventStore().appendEvents(events);
  await runProjectionBatch(200);

  return jsonOk(record, 201);
}
