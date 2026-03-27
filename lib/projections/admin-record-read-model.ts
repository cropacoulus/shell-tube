import type { FilmCourseRecord, FilmLessonRecord } from "@/lib/contracts/admin";
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

export async function listCourseRecordsFromProjection(): Promise<FilmCourseRecord[]> {
  const projectionStore = createDefaultProjectionStore();
  const courses =
    (await projectionStore.getJson<Record<string, CatalogCourseProjectionRecord>>(
      "stream:projection:catalog:courses",
    )) ?? {};

  return Object.values(courses)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((course) => ({
      id: course.courseId,
      creatorProfileId: course.creatorProfileId,
      title: course.title,
      synopsis: course.synopsis,
      year: course.year,
      categoryId: course.categoryId,
      heroImageUrl: course.heroImageUrl,
      cardImageUrl: course.cardImageUrl,
      publishStatus: course.publishStatus,
      createdAt: course.createdAt,
    }));
}

export async function getCourseRecordFromProjection(courseId: string): Promise<FilmCourseRecord | null> {
  const items = await listCourseRecordsFromProjection();
  return items.find((item) => item.id === courseId) ?? null;
}

export async function listLessonRecordsFromProjection(): Promise<FilmLessonRecord[]> {
  const projectionStore = createDefaultProjectionStore();
  const lessons =
    (await projectionStore.getJson<Record<string, CatalogLessonProjectionRecord>>(
      "stream:projection:catalog:lessons",
    )) ?? {};

  return Object.values(lessons)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((lesson) => ({
      id: lesson.lessonId,
      courseId: lesson.courseId,
      title: lesson.title,
      synopsis: lesson.synopsis,
      durationMin: lesson.durationMin,
      maturityRating: lesson.maturityRating,
      manifestBlobKey: lesson.manifestBlobKey,
      streamAssetId: lesson.streamAssetId,
      processingStatus: lesson.processingStatus,
      publishStatus: lesson.publishStatus,
      createdAt: lesson.createdAt,
    }));
}

export async function listLessonRecordsByCourseFromProjection(courseId: string): Promise<FilmLessonRecord[]> {
  const items = await listLessonRecordsFromProjection();
  return items.filter((item) => item.courseId === courseId);
}

export async function getLessonRecordFromProjection(lessonId: string): Promise<FilmLessonRecord | null> {
  const items = await listLessonRecordsFromProjection();
  return items.find((item) => item.id === lessonId) ?? null;
}
