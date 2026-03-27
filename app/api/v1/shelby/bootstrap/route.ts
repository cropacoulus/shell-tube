import type {
  ShelbyBootstrapRequest,
} from "@/lib/contracts/shelby";
import { jsonError, jsonOk } from "@/lib/server/http";
import { getPlaybackSessionFromProjection } from "@/lib/projections/playback-session-read-model";
import { getActivityRepository } from "@/lib/repositories";
import { createOptionBConfig } from "@/lib/runtime/option-b-config";
import { canBootstrapPlaybackSession } from "@/lib/server/playback-session-guard";
import { bootstrapShelby } from "@/lib/services/shelby-coordinator-client";
import { ServiceError } from "@/lib/services/http-client";
import { getAuthContextFromRequestOrBearer } from "@/lib/server/auth";

function isValidRequest(body: unknown): body is ShelbyBootstrapRequest {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate.playbackSessionId === "string" &&
    typeof candidate.titleId === "string" &&
    typeof candidate.region === "string" &&
    typeof candidate.deviceClass === "string" &&
    typeof candidate.networkType === "string" &&
    typeof candidate.maxPeers === "number"
  );
}

export async function POST(req: Request) {
  const auth = await getAuthContextFromRequestOrBearer(req);
  if (!auth) {
    return jsonError("UNAUTHORIZED", "Session is required", 401);
  }

  const body = (await req.json().catch(() => null)) as unknown;
  if (!isValidRequest(body)) {
    return jsonError("INVALID_REQUEST", "Malformed Shelby bootstrap request", 422);
  }

  try {
    const optionB = createOptionBConfig();
    const guard = canBootstrapPlaybackSession({
      session: optionB.projectionStoreBackend === "upstash"
        ? await getPlaybackSessionFromProjection(body.playbackSessionId)
        : await getActivityRepository().getPlaybackSessionRecordById(body.playbackSessionId),
      auth,
      titleId: body.titleId,
    });
    if (!guard.ok) {
      return jsonError(guard.code, guard.message, guard.status);
    }

    const response = await bootstrapShelby({
      ...body,
      userId: auth.userId,
      profileId: auth.profileId,
      region: body.region || auth.region,
    });
    return jsonOk(response);
  } catch (error) {
    if (error instanceof ServiceError) {
      return jsonError("UPSTREAM_ERROR", error.message, error.status);
    }

    return jsonError("INTERNAL_ERROR", "Unable to bootstrap Shelby", 500);
  }
}
