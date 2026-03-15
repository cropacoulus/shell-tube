import type {
  ContinueWatchingItem,
  HomePageResponse,
  HomeRail,
  TitleSummary,
} from "@/lib/contracts/catalog";
import type {
  RecommendationRail,
  RecommendationResponse,
} from "@/lib/contracts/recommendation";

const catalog: TitleSummary[] = [
  {
    id: "title_01",
    title: "Black Signal",
    synopsis: "A deep-sea satellite outage reveals a global financial conspiracy.",
    year: 2026,
    maturityRating: "16+",
    durationMin: 128,
    genres: ["Thriller", "Sci-Fi"],
    type: "movie",
    heroImageUrl: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1600&q=80",
    cardImageUrl: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=700&q=80",
  },
  {
    id: "title_02",
    title: "Jakarta Frequency",
    synopsis: "A radio host decodes hidden messages tied to missing people cases.",
    year: 2025,
    maturityRating: "13+",
    durationMin: 52,
    genres: ["Mystery", "Drama"],
    type: "series",
    heroImageUrl: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=1600&q=80",
    cardImageUrl: "https://images.unsplash.com/photo-1460881680858-30d872d5b530?auto=format&fit=crop&w=700&q=80",
  },
  {
    id: "title_03",
    title: "Long Form: Crypto Winter",
    synopsis: "Inside the collapse and rebuilding of global digital asset markets.",
    year: 2024,
    maturityRating: "13+",
    durationMin: 94,
    genres: ["Documentary"],
    type: "documentary",
    heroImageUrl: "https://images.unsplash.com/photo-1642052502473-02d4abf2f10d?auto=format&fit=crop&w=1600&q=80",
    cardImageUrl: "https://images.unsplash.com/photo-1639762681057-408e52192e55?auto=format&fit=crop&w=700&q=80",
  },
  {
    id: "title_04",
    title: "The Narrow Path",
    synopsis: "A former negotiator returns for one impossible hostage exchange.",
    year: 2023,
    maturityRating: "18+",
    durationMin: 111,
    genres: ["Action", "Crime"],
    type: "movie",
    heroImageUrl: "https://images.unsplash.com/photo-1509347528160-9a9e33742cdb?auto=format&fit=crop&w=1600&q=80",
    cardImageUrl: "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=700&q=80",
  },
  {
    id: "title_05",
    title: "Neon Alley",
    synopsis: "Underground racers and AI betting rings collide in one night.",
    year: 2026,
    maturityRating: "16+",
    durationMin: 45,
    genres: ["Action", "Sci-Fi"],
    type: "series",
    heroImageUrl: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=1600&q=80",
    cardImageUrl: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=700&q=80",
  },
  {
    id: "title_06",
    title: "Prime Numbers",
    synopsis: "A prodigy mathematician gets pulled into anti-fraud intelligence.",
    year: 2022,
    maturityRating: "13+",
    durationMin: 119,
    genres: ["Drama", "Crime"],
    type: "movie",
    heroImageUrl: "https://images.unsplash.com/photo-1524985069026-dd778a71c7b4?auto=format&fit=crop&w=1600&q=80",
    cardImageUrl: "https://images.unsplash.com/photo-1497015289639-54688650d173?auto=format&fit=crop&w=700&q=80",
  },
];

function pick(ids: string[]) {
  return ids
    .map((id) => catalog.find((title) => title.id === id))
    .filter((title): title is TitleSummary => Boolean(title));
}

export function getMockCatalogRailData(): HomeRail[] {
  return [
    { id: "trending", label: "Trending Now", titles: pick(["title_01", "title_04", "title_05", "title_03"]) },
    { id: "new", label: "New Releases", titles: pick(["title_05", "title_01", "title_02", "title_03"]) },
    { id: "crypto", label: "Because You Like Finance", titles: pick(["title_03", "title_06", "title_01", "title_02"]) },
  ];
}

export function getMockRecommendations(): RecommendationResponse {
  const rails: RecommendationRail[] = [
    {
      id: "for_you",
      label: "Top Picks For You",
      items: [
        { titleId: "title_01", score: 0.98, reason: "Because you watched cyber thrillers" },
        { titleId: "title_05", score: 0.93, reason: "Fast paced action matches your history" },
        { titleId: "title_02", score: 0.9, reason: "High completion among similar viewers" },
      ],
    },
  ];
  return { rails };
}

export function getMockContinueWatching(): ContinueWatchingItem[] {
  return [
    {
      titleId: "title_02",
      title: "Jakarta Frequency",
      cardImageUrl: catalog[1].cardImageUrl,
      progressPercent: 62,
      remainingMin: 20,
    },
    {
      titleId: "title_05",
      title: "Neon Alley",
      cardImageUrl: catalog[4].cardImageUrl,
      progressPercent: 38,
      remainingMin: 28,
    },
  ];
}

export function getMockHomePageResponse(): HomePageResponse {
  return {
    hero: catalog[0],
    rails: getMockCatalogRailData(),
    continueWatching: getMockContinueWatching(),
  };
}

export function getCatalogById(id: string): TitleSummary | undefined {
  return catalog.find((item) => item.id === id);
}
