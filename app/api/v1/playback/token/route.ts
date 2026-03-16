import { jsonError, jsonOk } from "@/lib/server/http";
import type {
  PlaybackTokenRequest,
} from "@/lib/contracts/playback";
import { getActivityRepository, getContentRepository } from "@/lib/repositories";
import { ServiceError } from "@/lib/services/http-client";
import { buildPlaybackContext, toEntitlementRequest } from "@/lib/server/playback-context";
import { checkEntitlement } from "@/lib/services/entitlement-client";
import { createPlaybackSession } from "@/lib/services/playback-client";
import { getAuthContextFromRequest } from "@/lib/server/auth";

function isValidRequest(body: unknown): body is PlaybackTokenRequest {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate.titleId === "string" &&
    typeof candidate.region === "string" &&
    typeof candidate.deviceClass === "string"
  );
}

export async function POST(req: Request) {
  const auth = getAuthContextFromRequest(req);
  if (!auth) {
    return jsonError("UNAUTHORIZED", "Session is required", 401);
  }

  const body = (await req.json().catch(() => null)) as unknown;
  if (!isValidRequest(body)) {
    return jsonError("INVALID_REQUEST", "Malformed playback token request", 422);
  }

  try {
    const lesson = await getContentRepository().getLessonRecordById(body.titleId);
    if (!lesson || lesson.publishStatus !== "published") {
      return jsonError("NOT_FOUND", "Lesson is not available for playback", 404);
    }
    if (!lesson.manifestBlobKey.trim()) {
      return jsonError("NOT_READY", "Lesson stream is not ready", 409);
    }

    const playbackContext = buildPlaybackContext(lesson);
    const entitlement = await checkEntitlement(
      toEntitlementRequest(playbackContext, {
        userId: auth.userId,
        profileId: auth.profileId,
        region: body.region || auth.region,
      }),
    );

    if (!entitlement.allowed) {
      return jsonError(
        "NOT_ENTITLED",
        entitlement.reason ?? "User is not entitled to play this title",
        403,
      );
    }

    const response = await createPlaybackSession({
      ...body,
      userId: auth.userId,
      profileId: auth.profileId,
      region: body.region || auth.region,
    });
    await getActivityRepository().createPlaybackSessionRecord({
      id: response.playbackSessionId,
      userId: auth.userId,
      profileId: auth.profileId,
      courseId: playbackContext.courseId,
      lessonId: playbackContext.lessonId,
      manifestBlobKey: playbackContext.manifestBlobKey,
      entitlementSource: entitlement.plan ?? entitlement.reason ?? "course_entitlement",
      playbackToken: response.token,
      expiresAt: response.expiresAt,
    });
    return jsonOk({
      ...response,
      lessonId: playbackContext.lessonId,
      courseId: playbackContext.courseId,
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      return jsonError("UPSTREAM_ERROR", error.message, error.status);
    }

    return jsonError("INTERNAL_ERROR", "Unable to create playback session", 500);
  }
}
