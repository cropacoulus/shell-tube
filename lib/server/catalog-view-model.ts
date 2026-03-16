import type { TitleSummary } from "@/lib/contracts/catalog";

export const buildLocalTitleSummary = (
  course: {
    id: string;
    title: string;
    synopsis: string;
    year: number;
    heroImageUrl: string;
    cardImageUrl: string;
  },
  lesson: {
    id: string;
    courseId: string;
    durationMin: number;
    maturityRating: string;
  },
): TitleSummary => {
  return {
    id: course.id,
    title: course.title,
    synopsis: course.synopsis,
    year: course.year,
    maturityRating: lesson.maturityRating,
    durationMin: lesson.durationMin,
    genres: ["Shelby Studio"],
    type: "movie",
    heroImageUrl: course.heroImageUrl,
    cardImageUrl: course.cardImageUrl,
  };
};
