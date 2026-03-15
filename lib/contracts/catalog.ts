export type ContentType = "movie" | "series" | "documentary";

export type TitleSummary = {
  id: string;
  title: string;
  synopsis: string;
  year: number;
  maturityRating: string;
  durationMin: number;
  genres: string[];
  type: ContentType;
  heroImageUrl: string;
  cardImageUrl: string;
};

export type HomeRail = {
  id: string;
  label: string;
  titles: TitleSummary[];
};

export type ContinueWatchingItem = {
  titleId: string;
  title: string;
  cardImageUrl: string;
  progressPercent: number;
  remainingMin: number;
};

export type HomePageResponse = {
  hero: TitleSummary;
  rails: HomeRail[];
  continueWatching: ContinueWatchingItem[];
};
