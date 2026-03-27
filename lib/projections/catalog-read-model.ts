import { createDefaultProjectionStore } from "@/lib/projection-store";
import { listCategoriesFromProjection } from "@/lib/projections/category-read-model";
import type { CourseSummary, LessonSummary } from "@/lib/server/course-flow";

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

async function getCategoryNameMap() {
  const categories = await listCategoriesFromProjection();
  return new Map(categories.map((item) => [item.id, item.name]));
}

async function getCatalogProjection() {
  const projectionStore = createDefaultProjectionStore();
  const [courses, lessons, categoryNameById] = await Promise.all([
    projectionStore.getJson<Record<string, CatalogCourseProjectionRecord>>("stream:projection:catalog:courses"),
    projectionStore.getJson<Record<string, CatalogLessonProjectionRecord>>("stream:projection:catalog:lessons"),
    getCategoryNameMap(),
  ]);

  return {
    courses: courses ?? {},
    lessons: lessons ?? {},
    categoryNameById,
  };
}

export async function listCourseSummariesFromProjection(): Promise<CourseSummary[]> {
  const { courses, categoryNameById } = await getCatalogProjection();

  return Object.values(courses)
    .filter((course) => course.publishStatus === "published")
    .sort((left, right) => left.title.localeCompare(right.title))
    .map((course) => ({
      id: course.courseId,
      title: course.title,
      description: course.synopsis,
      category: categoryNameById.get(course.categoryId) ?? course.categoryId,
      thumbnailUrl: course.cardImageUrl || course.heroImageUrl,
      year: course.year,
    }));
}

export async function listLessonsByCourseFromProjection(courseId: string): Promise<LessonSummary[]> {
  const { lessons } = await getCatalogProjection();

  return Object.values(lessons)
    .filter((lesson) => lesson.courseId === courseId && lesson.publishStatus === "published")
    .sort((left, right) => left.title.localeCompare(right.title))
    .map((lesson) => ({
      id: lesson.lessonId,
      courseId: lesson.courseId,
      title: lesson.title,
      description: lesson.synopsis,
      durationMin: lesson.durationMin,
      manifestBlobKey: lesson.manifestBlobKey,
    }));
}

export async function getCourseSummaryFromProjection(courseId: string): Promise<CourseSummary | null> {
  const { courses, categoryNameById } = await getCatalogProjection();
  const course = Object.values(courses).find((item) => item.courseId === courseId);
  if (!course || course.publishStatus !== "published") return null;

  return {
    id: course.courseId,
    title: course.title,
    description: course.synopsis,
    category: categoryNameById.get(course.categoryId) ?? course.categoryId,
    thumbnailUrl: course.cardImageUrl || course.heroImageUrl,
    year: course.year,
  };
}

export async function getLessonSummaryFromProjection(lessonId: string): Promise<LessonSummary | null> {
  const { lessons } = await getCatalogProjection();
  const lesson = Object.values(lessons).find((item) => item.lessonId === lessonId);
  if (!lesson || lesson.publishStatus !== "published") return null;

  return {
    id: lesson.lessonId,
    courseId: lesson.courseId,
    title: lesson.title,
    description: lesson.synopsis,
    durationMin: lesson.durationMin,
    manifestBlobKey: lesson.manifestBlobKey,
  };
}
