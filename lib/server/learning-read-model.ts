export type VideoLike = {
  id: string;
  title: string;
  synopsis: string;
  year: number;
  durationMin: number;
  categoryId: string;
  heroImageUrl: string;
  cardImageUrl: string;
  manifestBlobKey: string;
};

export type CategoryLike = {
  id: string;
  name: string;
};

export type CourseSummary = {
  id: string;
  title: string;
  description: string;
  category: string;
  thumbnailUrl: string;
  year: number;
};

export type LessonSummary = {
  id: string;
  courseId: string;
  title: string;
  description: string;
  durationMin: number;
  manifestBlobKey: string;
};

const buildLessonId = (courseId: string) => `lesson-${courseId}-main`;

export const listCourseSummaries = (
  videos: VideoLike[],
  categories: CategoryLike[],
): CourseSummary[] => {
  const categoryById = new Map(categories.map((item) => [item.id, item.name]));

  return videos.map((video) => ({
    id: video.id,
    title: video.title,
    description: video.synopsis,
    category: categoryById.get(video.categoryId) ?? "General",
    thumbnailUrl: video.cardImageUrl || video.heroImageUrl,
    year: video.year,
  }));
};

export const getCourseById = (
  videos: VideoLike[],
  categories: CategoryLike[],
  courseId: string,
): CourseSummary | null => {
  const courses = listCourseSummaries(videos, categories);
  return courses.find((course) => course.id === courseId) ?? null;
};

export const listLessonsByCourse = (
  videos: VideoLike[],
  courseId: string,
): LessonSummary[] => {
  return videos
    .filter((video) => video.id === courseId)
    .map((video) => ({
      id: buildLessonId(video.id),
      courseId: video.id,
      title: `${video.title} • Main Lesson`,
      description: video.synopsis,
      durationMin: video.durationMin,
      manifestBlobKey: video.manifestBlobKey,
    }));
};

export const getLessonById = (
  videos: VideoLike[],
  lessonId: string,
): LessonSummary | null => {
  for (const video of videos) {
    const lesson = {
      id: buildLessonId(video.id),
      courseId: video.id,
      title: `${video.title} • Main Lesson`,
      description: video.synopsis,
      durationMin: video.durationMin,
      manifestBlobKey: video.manifestBlobKey,
    };

    if (lesson.id === lessonId) {
      return lesson;
    }
  }

  return null;
};
