import type { HomePageResponse, HomeRail, TitleSummary } from "@/lib/contracts/catalog";
import { listCategories, listVideos } from "@/lib/server/data-store";
import { getCatalogRails, getTitleById } from "@/lib/services/catalog-client";
import { getMockHomePageResponse } from "@/lib/services/mock-data";
import { getRecommendations } from "@/lib/services/recommendation-client";
import { allowMockFallback } from "@/lib/services/runtime";

type HomeContext = {
  userId: string;
  profileId: string;
  region: string;
};

function mapAdminVideoToTitle(video: Awaited<ReturnType<typeof listVideos>>[number]): TitleSummary {
  return {
    id: video.id,
    title: video.title,
    synopsis: video.synopsis,
    year: video.year,
    maturityRating: video.maturityRating,
    durationMin: video.durationMin,
    genres: ["Shelby Studio"],
    type: "movie",
    heroImageUrl: video.heroImageUrl,
    cardImageUrl: video.cardImageUrl,
  };
}

function mergeRecommendationRails(
  catalogRails: HomeRail[],
  recommendations: Awaited<ReturnType<typeof getRecommendations>>,
): HomeRail[] {
  if (recommendations.rails.length === 0) return catalogRails;

  const byId = new Map<string, TitleSummary>();
  for (const rail of catalogRails) {
    for (const title of rail.titles) byId.set(title.id, title);
  }

  const recRails: HomeRail[] = recommendations.rails.map((rail) => ({
    id: rail.id,
    label: rail.label,
    titles: rail.items
      .map((item) => byId.get(item.titleId))
      .filter((title): title is TitleSummary => Boolean(title)),
  }));

  return [...recRails, ...catalogRails];
}

export async function getHomePageData(ctx: HomeContext): Promise<HomePageResponse> {
  try {
    const [catalogRails, recommendations, adminVideos, categories] = await Promise.all([
      getCatalogRails(ctx.region),
      getRecommendations(ctx.userId, ctx.profileId),
      listVideos(),
      listCategories(),
    ]);

    const categoryById = new Map(categories.map((item) => [item.id, item.name]));
    const adminRailsMap = new Map<string, TitleSummary[]>();
    for (const video of adminVideos) {
      const categoryName = categoryById.get(video.categoryId) ?? "Studio";
      const current = adminRailsMap.get(categoryName) ?? [];
      current.push(mapAdminVideoToTitle(video));
      adminRailsMap.set(categoryName, current);
    }

    const adminRails: HomeRail[] = Array.from(adminRailsMap.entries()).map(([label, titles], index) => ({
      id: `studio_${index}_${label.toLowerCase().replace(/\s+/g, "_")}`,
      label: `Studio • ${label}`,
      titles,
    }));

    const heroTitle =
      (adminRails[0]?.titles[0] ||
        (catalogRails[0]?.titles[0] &&
          (await getTitleById(catalogRails[0].titles[0].id))) ||
        catalogRails[0]?.titles[0]);

    if (!heroTitle) {
      if (allowMockFallback()) return getMockHomePageResponse();
      throw new Error("Missing hero title from upstream services");
    }

    return {
      hero: heroTitle,
      rails: [...adminRails, ...mergeRecommendationRails(catalogRails, recommendations)],
      continueWatching: getMockHomePageResponse().continueWatching,
    };
  } catch {
    if (allowMockFallback()) return getMockHomePageResponse();
    throw new Error("Home aggregation failed in strict mode");
  }
}
