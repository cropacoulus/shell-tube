import { getContentRepository } from "@/lib/repositories";
import type { CourseSummary, LessonSummary } from "@/lib/server/learning-read-model";

export type { CourseSummary, LessonSummary } from "@/lib/server/learning-read-model";

function buildCourseSummary(
  course: {
    id: string;
    title: string;
    synopsis: string;
    year: number;
    categoryId: string;
    heroImageUrl: string;
    cardImageUrl: string;
  },
  categoryName: string,
): CourseSummary {
  return {
    id: course.id,
    title: course.title,
    description: course.synopsis,
    category: categoryName,
    thumbnailUrl: course.cardImageUrl || course.heroImageUrl,
    year: course.year,
  };
}

function buildLessonSummary(lesson: {
  id: string;
  courseId: string;
  title: string;
  synopsis: string;
  durationMin: number;
  manifestBlobKey: string;
}): LessonSummary {
  return {
    id: lesson.id,
    courseId: lesson.courseId,
    title: lesson.title,
    description: lesson.synopsis,
    durationMin: lesson.durationMin,
    manifestBlobKey: lesson.manifestBlobKey,
  };
}

export async function listCourseSummaries(): Promise<CourseSummary[]> {
  const repository = getContentRepository();
  const [courses, categories] = await Promise.all([
    repository.listCourseRecords(),
    repository.listCategories(),
  ]);
  const categoryById = new Map(categories.map((item) => [item.id, item.name]));
  return courses
    .filter((course) => course.publishStatus === "published")
    .map((course) => buildCourseSummary(course, categoryById.get(course.categoryId) ?? "General"));
}

export async function getCourseById(id: string): Promise<CourseSummary | null> {
  const repository = getContentRepository();
  const [course, categories] = await Promise.all([
    repository.getCourseRecordById(id),
    repository.listCategories(),
  ]);
  if (!course || course.publishStatus !== "published") return null;
  const categoryName = categories.find((item) => item.id === course.categoryId)?.name ?? "General";
  return buildCourseSummary(course, categoryName);
}

export async function listLessonsByCourse(courseId: string): Promise<LessonSummary[]> {
  const lessons = await getContentRepository().listLessonRecordsByCourse(courseId);
  return lessons
    .filter((lesson) => lesson.publishStatus === "published")
    .map((lesson) => buildLessonSummary(lesson));
}

export async function getLessonById(lessonId: string): Promise<LessonSummary | null> {
  const lesson = await getContentRepository().getLessonRecordById(lessonId);
  if (!lesson || lesson.publishStatus !== "published") return null;
  return buildLessonSummary(lesson);
}
