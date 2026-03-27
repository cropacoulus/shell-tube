import { canModeratePlatform } from "@/lib/auth/capabilities";
import { listCategoriesFromProjection } from "@/lib/projections/category-read-model";
import type { AdminContentItem } from "@/lib/server/admin-content-model";
import type { CourseSummary } from "@/lib/server/course-flow";
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
  createdAt: string;
  updatedAt: string;
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
  processingStatus?: "idle" | "source_uploaded" | "packaging_requested" | "manifest_ready";
  publishStatus: "draft" | "published";
  createdAt: string;
  updatedAt: string;
};

async function getCreatorProjection() {
  const projectionStore = createDefaultProjectionStore();
  const [courses, lessons, categories] = await Promise.all([
    projectionStore.getJson<Record<string, CatalogCourseProjectionRecord>>("stream:projection:catalog:courses"),
    projectionStore.getJson<Record<string, CatalogLessonProjectionRecord>>("stream:projection:catalog:lessons"),
    listCategoriesFromProjection(),
  ]);

  return {
    courses: courses ?? {},
    lessons: lessons ?? {},
    categoryById: new Map(categories.map((item) => [item.id, item.name])),
  };
}

export async function listCreatorOwnedCourseSummariesFromProjection(input: {
  profileId: string;
  role: "student" | "creator" | "admin";
}): Promise<CourseSummary[]> {
  const { courses, categoryById } = await getCreatorProjection();

  return Object.values(courses)
    .filter((course) => canModeratePlatform(input.role) || course.creatorProfileId === input.profileId)
    .sort((left, right) => left.title.localeCompare(right.title))
    .map((course) => ({
      id: course.courseId,
      title: course.title,
      description: course.synopsis,
      category: categoryById.get(course.categoryId) ?? course.categoryId,
      thumbnailUrl: course.cardImageUrl || course.heroImageUrl,
      year: course.year,
    }));
}

export async function canAccessCreatorCourseFromProjection(input: {
  courseId: string;
  profileId: string;
  role: "student" | "creator" | "admin";
}): Promise<boolean> {
  if (canModeratePlatform(input.role)) return true;

  const { courses } = await getCreatorProjection();
  const course = Object.values(courses).find((item) => item.courseId === input.courseId);
  return Boolean(course && course.creatorProfileId === input.profileId);
}

export async function listCreatorOwnedAdminContentItemsFromProjection(input: {
  profileId: string;
  role: "student" | "creator" | "admin";
}): Promise<AdminContentItem[]> {
  const { courses, lessons } = await getCreatorProjection();

  const courseList = Object.values(courses).filter(
    (course) => canModeratePlatform(input.role) || course.creatorProfileId === input.profileId,
  );
  const lessonList = Object.values(lessons);

  const items = courseList
    .map((course) => {
      const lesson = lessonList.find((item) => item.courseId === course.courseId);
      if (!lesson) return null;
      return {
        id: course.courseId,
        courseId: course.courseId,
        lessonId: lesson.lessonId,
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
        processingStatus: lesson.processingStatus,
        publishStatus:
          lesson.publishStatus === "draft" || course.publishStatus === "draft" ? "draft" : "published",
        createdAt: course.createdAt,
      } as AdminContentItem;
    })
    .filter((item): item is AdminContentItem => item !== null);

  return items.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getCreatorAdminContentItemByCourseIdFromProjection(
  courseId: string,
): Promise<AdminContentItem | null> {
  const { courses, lessons } = await getCreatorProjection();
  const course = Object.values(courses).find((item) => item.courseId === courseId);
  if (!course) return null;
  const lesson = Object.values(lessons).find((item) => item.courseId === courseId);
  if (!lesson) return null;

  return {
    id: course.courseId,
    courseId: course.courseId,
    lessonId: lesson.lessonId,
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
    processingStatus: lesson.processingStatus,
    publishStatus:
      lesson.publishStatus === "draft" || course.publishStatus === "draft" ? "draft" : "published",
    createdAt: course.createdAt,
  };
}
