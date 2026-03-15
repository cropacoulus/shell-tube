import { jsonError, jsonOk } from "@/lib/server/http";
import type {
  PlaybackTokenRequest,
} from "@/lib/contracts/playback";
import { ServiceError } from "@/lib/services/http-client";
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
    const entitlement = await checkEntitlement({
      userId: auth.userId,
      profileId: auth.profileId,
      titleId: body.titleId,
      region: body.region || auth.region,
    });

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
    return jsonOk(response);
  } catch (error) {
    if (error instanceof ServiceError) {
      return jsonError("UPSTREAM_ERROR", error.message, error.status);
    }

    return jsonError("INTERNAL_ERROR", "Unable to create playback session", 500);
  }
}
