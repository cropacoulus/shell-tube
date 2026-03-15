import type { EntitlementRequest, EntitlementResponse } from "@/lib/contracts/entitlement";
import { requestJson, ServiceError } from "@/lib/services/http-client";
import { allowMockFallback } from "@/lib/services/runtime";

export async function checkEntitlement(
  payload: EntitlementRequest,
): Promise<EntitlementResponse> {
  const baseUrl = process.env.ENTITLEMENT_SERVICE_URL;
  const token = process.env.SERVICE_AUTH_TOKEN;
  if (!baseUrl && !allowMockFallback()) {
    throw new ServiceError("entitlement", 503, "Entitlement service is not configured");
  }
  if (!baseUrl) {
    return { allowed: true, plan: "premium" };
  }
  return requestJson<EntitlementResponse>({
    service: "entitlement",
    baseUrl,
    token,
    path: "/v1/entitlements/check",
    method: "POST",
    body: payload,
  });
}
