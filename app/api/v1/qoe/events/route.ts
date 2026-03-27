import type { QoeEventsIngestRequest, QoeEventsIngestResponse } from "@/lib/contracts/qoe";
import { createDomainEvent } from "@/lib/events/event-factory";
import { buildEventIdempotencyKey } from "@/lib/events/idempotency";
import { runProjectionBatch } from "@/lib/jobs/projection-runner";
import { getPlaybackSessionFromProjection } from "@/lib/projections/playback-session-read-model";
import { getActivityRepository, getEventStore } from "@/lib/repositories";
import { createOptionBConfig } from "@/lib/runtime/option-b-config";
import { jsonError, jsonOk } from "@/lib/server/http";
import { ingestQoeEvents } from "@/lib/services/analytics-client";
import { ServiceError } from "@/lib/services/http-client";
import { getAuthContextFromRequest } from "@/lib/server/auth";
import { allowMockFallback } from "@/lib/services/runtime";

function isValidRequest(body: unknown): body is QoeEventsIngestRequest {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;
  return Array.isArray(candidate.events);
}

export async function POST(req: Request) {
  const auth = getAuthContextFromRequest(req);
  if (!auth) {
    return jsonError("UNAUTHORIZED", "Session is required", 401);
  }

  const body = (await req.json().catch(() => null)) as unknown;
  if (!isValidRequest(body)) {
    return jsonError("INVALID_REQUEST", "Malformed QoE events payload", 422);
  }

  try {
    if (!process.env.ANALYTICS_SERVICE_URL && allowMockFallback()) {
      const activityRepository = getActivityRepository();
      const optionB = createOptionBConfig();
      const records = [];
      let dropped = 0;

      for (const event of body.events) {
        const session = optionB.projectionStoreBackend === "upstash"
          ? await getPlaybackSessionFromProjection(event.playbackSessionId)
          : await activityRepository.getPlaybackSessionRecordById(event.playbackSessionId);
        if (!session || session.userId !== auth.userId || session.lessonId !== event.titleId) {
          dropped += 1;
          continue;
        }
        records.push({
          playbackSessionId: session.id,
          userId: session.userId,
          profileId: session.profileId,
          courseId: session.courseId,
          lessonId: session.lessonId,
          type: event.type,
          eventTs: event.eventTs,
          positionMs: event.positionMs,
          bitrateKbps: event.bitrateKbps,
          rebufferMs: event.rebufferMs,
          peerHitRatio: event.peerHitRatio,
          errorCode: event.errorCode,
          deviceId: event.deviceId,
        });
      }

      if (optionB.projectionStoreBackend !== "upstash") {
        await activityRepository.createQoeEventRecords(records);
      }
      await getEventStore().appendEvents(
        records.map((record) =>
          createDomainEvent({
            type: "qoe_event_recorded",
            aggregateType: "qoe",
            aggregateId: `${record.playbackSessionId}:${record.eventTs}:${record.type}`,
            actor: {
              userId: auth.userId,
              role: auth.role,
            },
            idempotencyKey: buildEventIdempotencyKey(
              "qoe-event",
              record.playbackSessionId,
              record.eventTs,
              record.type,
              record.positionMs,
            ),
            payload: {
              playbackSessionId: record.playbackSessionId,
              lessonId: record.lessonId,
              courseId: record.courseId,
              userId: record.userId,
              profileId: record.profileId,
              type: record.type,
              eventTs: record.eventTs,
              positionMs: record.positionMs,
              bitrateKbps: record.bitrateKbps,
              rebufferMs: record.rebufferMs,
              peerHitRatio: record.peerHitRatio,
              errorCode: record.errorCode,
              deviceId: record.deviceId,
            },
          }),
        ),
      );
      await runProjectionBatch(200);
      const response: QoeEventsIngestResponse = { accepted: records.length, dropped };
      return jsonOk(response, 202);
    }

    const response: QoeEventsIngestResponse = await ingestQoeEvents(body);
    return jsonOk(response, 202);
  } catch (error) {
    if (error instanceof ServiceError) {
      return jsonError("UPSTREAM_ERROR", error.message, error.status);
    }

    return jsonError("INTERNAL_ERROR", "Unable to ingest QoE events", 500);
  }
}
