import { jsonError, jsonOk } from "@/lib/server/http";
import type {
  PlaybackTokenRequest,
} from "@/lib/contracts/playback";
import type { PlaybackSessionRecord } from "@/lib/contracts/activity";
import { createDomainEvent } from "@/lib/events/event-factory";
import { buildEventIdempotencyKey } from "@/lib/events/idempotency";
import { runProjectionBatch } from "@/lib/jobs/projection-runner";
import { getPublishedLessonFromProjection } from "@/lib/projections/lesson-read-model";
import { getActivityRepository, getContentRepository, getEventStore } from "@/lib/repositories";
import { createOptionBConfig } from "@/lib/runtime/option-b-config";
import { ServiceError } from "@/lib/services/http-client";
import { buildPlaybackContext, toEntitlementRequest } from "@/lib/server/playback-context";
import { checkEntitlement } from "@/lib/services/entitlement-client";
import { createPlaybackSession } from "@/lib/services/playback-client";
import { getAuthContextFromRequestOrBearer } from "@/lib/server/auth";

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
  const auth = await getAuthContextFromRequestOrBearer(req);
  if (!auth) {
    return jsonError("UNAUTHORIZED", "Session is required", 401);
  }

  const body = (await req.json().catch(() => null)) as unknown;
  if (!isValidRequest(body)) {
    return jsonError("INVALID_REQUEST", "Malformed playback token request", 422);
  }

  try {
    const optionB = createOptionBConfig();
    const lesson = optionB.projectionStoreBackend === "upstash"
      ? await getPublishedLessonFromProjection(body.titleId)
      : await getContentRepository().getLessonRecordById(body.titleId);
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
    const sessionRecord: PlaybackSessionRecord = {
      id: response.playbackSessionId,
      userId: auth.userId,
      profileId: auth.profileId,
      courseId: playbackContext.courseId,
      lessonId: playbackContext.lessonId,
      manifestBlobKey: playbackContext.manifestBlobKey,
      entitlementSource: entitlement.plan ?? entitlement.reason ?? "course_entitlement",
      playbackToken: response.token,
      expiresAt: response.expiresAt,
      createdAt: new Date().toISOString(),
    };
    if (optionB.projectionStoreBackend !== "upstash") {
      await getActivityRepository().createPlaybackSessionRecord({
        id: sessionRecord.id,
        userId: sessionRecord.userId,
        profileId: sessionRecord.profileId,
        courseId: sessionRecord.courseId,
        lessonId: sessionRecord.lessonId,
        manifestBlobKey: sessionRecord.manifestBlobKey,
        entitlementSource: sessionRecord.entitlementSource,
        playbackToken: sessionRecord.playbackToken,
        expiresAt: sessionRecord.expiresAt,
      });
    }
    await getEventStore().appendEvent(
      createDomainEvent({
        type: "playback_session_created",
        aggregateType: "playback_session",
        aggregateId: response.playbackSessionId,
        actor: {
          userId: auth.userId,
          role: auth.role,
        },
        idempotencyKey: buildEventIdempotencyKey("playback-session-create", response.playbackSessionId),
        payload: {
          playbackSessionId: response.playbackSessionId,
          lessonId: playbackContext.lessonId,
          courseId: playbackContext.courseId,
          userId: auth.userId,
          profileId: auth.profileId,
          manifestBlobKey: playbackContext.manifestBlobKey,
          entitlementSource: entitlement.plan ?? entitlement.reason ?? "course_entitlement",
          expiresAt: response.expiresAt,
          createdAt: sessionRecord.createdAt,
        },
      }),
    );
    await runProjectionBatch(200);
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
