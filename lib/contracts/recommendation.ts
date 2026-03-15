export type RecommendationRequest = {
  userId: string;
  profileId: string;
  limit?: number;
};

export type RecommendationItem = {
  titleId: string;
  score: number;
  reason: string;
};

export type RecommendationRail = {
  id: string;
  label: string;
  items: RecommendationItem[];
};

export type RecommendationResponse = {
  rails: RecommendationRail[];
};
