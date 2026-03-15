import type { RecommendationResponse } from "@/lib/contracts/recommendation";
import { requestJson, ServiceError } from "@/lib/services/http-client";
import { getMockRecommendations } from "@/lib/services/mock-data";
import { allowMockFallback } from "@/lib/services/runtime";

export async function getRecommendations(
  userId: string,
  profileId: string,
): Promise<RecommendationResponse> {
  const baseUrl = process.env.RECOMMENDATION_SERVICE_URL;
  const token = process.env.SERVICE_AUTH_TOKEN;
  if (!baseUrl && !allowMockFallback()) {
    throw new ServiceError(
      "recommendation",
      503,
      "Recommendation service is not configured",
    );
  }
  if (!baseUrl) return getMockRecommendations();
  return requestJson<RecommendationResponse>({
    service: "recommendation",
    baseUrl,
    token,
    path: "/v1/recommendations",
    method: "POST",
    body: { userId, profileId, limit: 24 },
  });
}
