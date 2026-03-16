import type {
  FilmCourseRecord,
  FilmLessonRecord,
  FilmVideo,
  VideoPublishStatus,
} from "@/lib/contracts/admin";

type LegacyVideoRecord = Omit<FilmVideo, "publishStatus"> & { publishStatus?: VideoPublishStatus };

type NormalizeResult = {
  courses: FilmCourseRecord[];
  lessons: FilmLessonRecord[];
};

const buildMainLessonId = (courseId: string) => `lesson-${courseId}-main`;

export const normalizeLegacyVideos = (videos: LegacyVideoRecord[]): NormalizeResult => {
  const courses: FilmCourseRecord[] = [];
  const lessons: FilmLessonRecord[] = [];

  for (const video of videos) {
    courses.push({
      id: video.id,
      creatorProfileId: undefined,
      title: video.title,
      synopsis: video.synopsis,
      year: video.year,
      categoryId: video.categoryId,
      heroImageUrl: video.heroImageUrl,
      cardImageUrl: video.cardImageUrl,
      publishStatus: video.publishStatus ?? "published",
      createdAt: video.createdAt,
    });

    lessons.push({
      id: buildMainLessonId(video.id),
      courseId: video.id,
      title: `${video.title} • Main Lesson`,
      synopsis: video.synopsis,
      durationMin: video.durationMin,
      maturityRating: video.maturityRating,
      manifestBlobKey: video.manifestBlobKey,
      streamAssetId: video.streamAssetId,
      publishStatus: video.publishStatus ?? "published",
      createdAt: video.createdAt,
    });
  }

  return { courses, lessons };
};

export const buildVideoCompatibilityRecord = (
  course: FilmCourseRecord,
  lesson: FilmLessonRecord,
): FilmVideo => {
  const publishStatus: VideoPublishStatus =
    lesson.publishStatus === "draft" || course.publishStatus === "draft" ? "draft" : "published";

  return {
    id: course.id,
    title: course.title,
    synopsis: course.synopsis,
    year: course.year,
    maturityRating: lesson.maturityRating,
    durationMin: lesson.durationMin,
    categoryId: course.categoryId,
    heroImageUrl: course.heroImageUrl,
    cardImageUrl: course.cardImageUrl,
    manifestBlobKey: lesson.manifestBlobKey,
    streamAssetId: lesson.streamAssetId,
    publishStatus,
    createdAt: course.createdAt,
  };
};

export const buildMainLessonInput = (course: {
  id: string;
  title: string;
  synopsis: string;
  durationMin: number;
  maturityRating: string;
  manifestBlobKey: string;
  streamAssetId?: string;
  publishStatus: VideoPublishStatus;
  createdAt: string;
}): FilmLessonRecord => {
  return {
    id: buildMainLessonId(course.id),
    courseId: course.id,
    title: `${course.title} • Main Lesson`,
    synopsis: course.synopsis,
    durationMin: course.durationMin,
    maturityRating: course.maturityRating,
    manifestBlobKey: course.manifestBlobKey,
    streamAssetId: course.streamAssetId,
    publishStatus: course.publishStatus,
    createdAt: course.createdAt,
  };
};
