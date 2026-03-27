import type { ProjectionStore } from "../projection-store/projection-store.ts";

export type ProgressProjectionSnapshot = {
  id: string;
  userId: string;
  profileId: string;
  lessonId: string;
  courseId: string;
  progressPercent: number;
  lastPositionSec: number;
  completedAt?: string;
  updatedAt: string;
};

export async function listLessonProgressByUserFromProjection(
  userId: string,
): Promise<ProgressProjectionSnapshot[]> {
  const { createDefaultProjectionStore } = await import("../projection-store/index.ts");
  return listLessonProgressByUserFromStore(createDefaultProjectionStore(), userId);
}

export async function listLessonProgressByUserFromStore(
  projectionStore: ProjectionStore,
  userId: string,
): Promise<ProgressProjectionSnapshot[]> {
  const progress =
    (await projectionStore.getJson<Record<string, ProgressProjectionSnapshot>>("stream:projection:activity:progress")) ?? {};

  return Object.values(progress)
    .filter((item) => item.userId === userId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function getLessonProgressByUserAndLessonFromProjection(
  userId: string,
  lessonId: string,
): Promise<ProgressProjectionSnapshot | null> {
  const items = await listLessonProgressByUserFromProjection(userId);
  return items.find((item) => item.lessonId === lessonId) ?? null;
}
