import { completePackagingForLesson } from "@/lib/jobs/media-processing-runner";
import { runProjectionBatch } from "@/lib/jobs/projection-runner";
import { getLessonFromProjection } from "@/lib/projections/lesson-read-model";
import { createOptionBConfig } from "@/lib/runtime/option-b-config";
import { jsonError, jsonOk } from "@/lib/server/http";

type CompletePackagingRequest = {
  lessonId: string;
  courseId?: string;
  manifestBlobKey?: string;
};

function isAuthorized(req: Request) {
  const config = createOptionBConfig();
  if (!config.cronSecret) return false;

  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;
  return authorization.slice("Bearer ".length) === config.cronSecret;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return jsonError("FORBIDDEN", "Cron secret is required", 403);
  }

  const body = (await req.json().catch(() => null)) as CompletePackagingRequest | null;
  if (!body?.lessonId) {
    return jsonError("INVALID_REQUEST", "lessonId is required", 422);
  }

  const lesson = await getLessonFromProjection(body.lessonId);
  if (!lesson) {
    return jsonError("NOT_FOUND", "Lesson was not found", 404);
  }
  if (!lesson.streamAssetId) {
    return jsonError("INVALID_REQUEST", "Source asset is missing for this lesson.", 422);
  }
  if (lesson.manifestBlobKey) {
    return jsonOk({
      lessonId: lesson.id,
      courseId: lesson.courseId,
      manifestBlobKey: lesson.manifestBlobKey,
      alreadyCompleted: true,
    });
  }

  const completed = await completePackagingForLesson({
    lessonId: lesson.id,
    courseId: body.courseId || lesson.courseId,
    manifestBlobKey: body.manifestBlobKey,
    actorUserId: "system:media-processor",
    source: "external-media-processor",
  });
  const projection = await runProjectionBatch(500);

  return jsonOk({
    ...completed,
    projection,
  });
}
