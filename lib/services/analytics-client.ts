import type {
  AnalyticsIngestRequest,
  AnalyticsIngestResponse,
} from "@/lib/contracts/analytics";
import { requestJson, ServiceError } from "@/lib/services/http-client";
import { allowMockFallback } from "@/lib/services/runtime";

export async function ingestQoeEvents(
  payload: AnalyticsIngestRequest,
): Promise<AnalyticsIngestResponse> {
  const baseUrl = process.env.ANALYTICS_SERVICE_URL;
  const token = process.env.SERVICE_AUTH_TOKEN;
  if (!baseUrl && !allowMockFallback()) {
    throw new ServiceError("analytics", 503, "Analytics service is not configured");
  }
  if (!baseUrl) {
    return { accepted: payload.events.length, dropped: 0 };
  }

  return requestJson<AnalyticsIngestResponse>({
    service: "analytics",
    baseUrl,
    token,
    path: "/v1/analytics/qoe-events",
    method: "POST",
    body: payload,
  });
}
