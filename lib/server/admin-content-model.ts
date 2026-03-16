import type {
  FilmCourseRecord,
  FilmLessonRecord,
  VideoPublishStatus,
} from "@/lib/contracts/admin";

export type AdminContentItem = {
  id: string;
  courseId: string;
  lessonId: string;
  creatorProfileId?: string;
  title: string;
  synopsis: string;
  categoryId: string;
  year: number;
  durationMin: number;
  maturityRating: string;
  heroImageUrl: string;
  cardImageUrl: string;
  manifestBlobKey: string;
  streamAssetId?: string;
  publishStatus: VideoPublishStatus;
  createdAt: string;
};

export type AdminContentInput = {
  creatorProfileId?: string;
  title: string;
  synopsis: string;
  year: number;
  categoryId: string;
  heroImageUrl: string;
  cardImageUrl: string;
  durationMin: number;
  maturityRating: string;
  manifestBlobKey: string;
  streamAssetId?: string;
  publishStatus: VideoPublishStatus;
};

export const buildAdminContentItem = (
  course: FilmCourseRecord,
  lesson: FilmLessonRecord,
): AdminContentItem => {
  return {
    id: course.id,
    courseId: course.id,
    lessonId: lesson.id,
    creatorProfileId: course.creatorProfileId,
    title: course.title,
    synopsis: course.synopsis,
    categoryId: course.categoryId,
    year: course.year,
    durationMin: lesson.durationMin,
    maturityRating: lesson.maturityRating,
    heroImageUrl: course.heroImageUrl,
    cardImageUrl: course.cardImageUrl,
    manifestBlobKey: lesson.manifestBlobKey,
    streamAssetId: lesson.streamAssetId,
    publishStatus: lesson.publishStatus === "draft" || course.publishStatus === "draft" ? "draft" : "published",
    createdAt: course.createdAt,
  };
};

export const splitAdminContentInput = (input: AdminContentInput) => {
  return {
    course: {
      creatorProfileId: input.creatorProfileId,
      title: input.title,
      synopsis: input.synopsis,
      year: input.year,
      categoryId: input.categoryId,
      heroImageUrl: input.heroImageUrl,
      cardImageUrl: input.cardImageUrl,
      publishStatus: input.publishStatus,
    },
    lesson: {
      title: `${input.title} • Main Lesson`,
      synopsis: input.synopsis,
      durationMin: input.durationMin,
      maturityRating: input.maturityRating,
      manifestBlobKey: input.manifestBlobKey,
      streamAssetId: input.streamAssetId,
      publishStatus: input.publishStatus,
    },
  };
};
