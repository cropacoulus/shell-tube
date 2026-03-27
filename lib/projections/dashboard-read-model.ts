import type { ContinueWatchingItem } from "@/lib/contracts/catalog";
import { createDefaultProjectionStore } from "@/lib/projection-store";

export type DashboardProjectionSnapshot = {
  activeCourseCount: number;
  completedLessonCount: number;
  continueWatching: ContinueWatchingItem[];
};

export async function getDashboardSnapshotFromProjection(userId: string): Promise<DashboardProjectionSnapshot> {
  const projectionStore = createDefaultProjectionStore();
  const dashboards =
    (await projectionStore.getJson<Record<string, DashboardProjectionSnapshot>>(
      "stream:projection:student-dashboard:all",
    )) ?? {};

  return dashboards[userId] ?? {
    activeCourseCount: 0,
    completedLessonCount: 0,
    continueWatching: [],
  };
}
