import type { HomeRail, TitleSummary } from "@/lib/contracts/catalog";
import { listVideos } from "@/lib/server/data-store";
import { requestJson, ServiceError } from "@/lib/services/http-client";
import { getCatalogById, getMockCatalogRailData } from "@/lib/services/mock-data";
import { allowMockFallback } from "@/lib/services/runtime";

export async function getCatalogRails(region: string): Promise<HomeRail[]> {
  const baseUrl = process.env.CATALOG_SERVICE_URL;
  const token = process.env.SERVICE_AUTH_TOKEN;
  if (!baseUrl && !allowMockFallback()) {
    throw new ServiceError("catalog", 503, "Catalog service is not configured");
  }
  if (!baseUrl) return getMockCatalogRailData();
  return requestJson<HomeRail[]>({
    service: "catalog",
    baseUrl,
    token,
    path: `/v1/catalog/home?region=${encodeURIComponent(region)}`,
  });
}

export async function getTitleById(titleId: string): Promise<TitleSummary | null> {
  const adminVideo = (await listVideos()).find((item) => item.id === titleId);
  if (adminVideo) {
    return {
      id: adminVideo.id,
      title: adminVideo.title,
      synopsis: adminVideo.synopsis,
      year: adminVideo.year,
      maturityRating: adminVideo.maturityRating,
      durationMin: adminVideo.durationMin,
      genres: ["Shelby Studio"],
      type: "movie",
      heroImageUrl: adminVideo.heroImageUrl,
      cardImageUrl: adminVideo.cardImageUrl,
    };
  }

  const baseUrl = process.env.CATALOG_SERVICE_URL;
  const token = process.env.SERVICE_AUTH_TOKEN;
  if (!baseUrl && !allowMockFallback()) {
    throw new ServiceError("catalog", 503, "Catalog service is not configured");
  }
  if (!baseUrl) return getCatalogById(titleId) ?? null;
  return requestJson<TitleSummary>({
    service: "catalog",
    baseUrl,
    token,
    path: `/v1/catalog/titles/${encodeURIComponent(titleId)}`,
  });
}
