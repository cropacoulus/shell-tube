import { createDefaultProjectionStore } from "@/lib/projection-store";

type CatalogCourseProjectionRecord = {
  courseId: string;
  creatorProfileId?: string;
  title: string;
  synopsis: string;
  year: number;
  categoryId: string;
  heroImageUrl: string;
  cardImageUrl: string;
  publishStatus: "draft" | "published";
};

type CatalogLessonProjectionRecord = {
  lessonId: string;
  courseId: string;
  title: string;
  synopsis: string;
  durationMin: number;
  maturityRating: string;
  manifestBlobKey: string;
  streamAssetId?: string;
  publishStatus: "draft" | "published";
};

export async function getLessonDetailFromProjection(lessonId: string) {
  const projectionStore = createDefaultProjectionStore();
  const [courses, lessons] = await Promise.all([
    projectionStore.getJson<Record<string, CatalogCourseProjectionRecord>>("stream:projection:catalog:courses"),
    projectionStore.getJson<Record<string, CatalogLessonProjectionRecord>>("stream:projection:catalog:lessons"),
  ]);

  const lesson = (lessons ?? {})[lessonId];
  if (!lesson || lesson.publishStatus !== "published") return null;

  const course = Object.values(courses ?? {}).find((item) => item.courseId === lesson.courseId);
  if (!course || course.publishStatus !== "published") return null;

  return {
    course: {
      id: course.courseId,
      title: course.title,
      description: course.synopsis,
      thumbnailUrl: course.cardImageUrl || course.heroImageUrl,
      year: course.year,
      category: course.categoryId,
    },
    lesson: {
      id: lesson.lessonId,
      courseId: lesson.courseId,
      title: lesson.title,
      description: lesson.synopsis,
      durationMin: lesson.durationMin,
      manifestBlobKey: lesson.manifestBlobKey,
    },
  };
}
