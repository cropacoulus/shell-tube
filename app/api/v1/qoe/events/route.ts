import type { QoeEventsIngestRequest, QoeEventsIngestResponse } from "@/lib/contracts/qoe";
import { jsonError, jsonOk } from "@/lib/server/http";
import { ingestQoeEvents } from "@/lib/services/analytics-client";
import { ServiceError } from "@/lib/services/http-client";
import { getAuthContextFromRequest } from "@/lib/server/auth";

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
    const response: QoeEventsIngestResponse = await ingestQoeEvents(body);
    return jsonOk(response, 202);
  } catch (error) {
    if (error instanceof ServiceError) {
      return jsonError("UPSTREAM_ERROR", error.message, error.status);
    }

    return jsonError("INTERNAL_ERROR", "Unable to ingest QoE events", 500);
  }
}
