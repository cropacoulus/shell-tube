import { getAuthContextFromRequest } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { getActivityRepository, getContentRepository } from "@/lib/repositories";

type ProgressWriteRequest = {
  lessonId: string;
  progressPercent: number;
  lastPositionSec: number;
};

export async function GET(req: Request) {
  const auth = getAuthContextFromRequest(req);
  if (!auth) return jsonError("UNAUTHORIZED", "Session is required", 401);
  const items = await getActivityRepository().listLessonProgressByUser(auth.userId);
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

  const lesson = await getContentRepository().getLessonRecordById(body.lessonId);
  if (!lesson) {
    return jsonError("NOT_FOUND", "Lesson not found", 404);
  }

  const progressPercent = Math.min(100, Math.max(0, Math.round(body.progressPercent)));
  const record = await getActivityRepository().upsertLessonProgress({
    userId: auth.userId,
    profileId: auth.profileId,
    lessonId: lesson.id,
    courseId: lesson.courseId,
    progressPercent,
    lastPositionSec: Math.max(0, Math.round(body.lastPositionSec)),
    ...(progressPercent >= 100 ? { completedAt: new Date().toISOString() } : {}),
  });

  await getActivityRepository().upsertCourseEnrollment({
    userId: auth.userId,
    profileId: auth.profileId,
    courseId: lesson.courseId,
    source: "manual",
    active: true,
  });

  return jsonOk(record, 201);
}
