import { createDefaultProjectionStore } from "@/lib/projection-store";
import type {
  CreatorAnalyticsSnapshot,
  CreatorCourseAnalyticsSnapshot,
} from "@/lib/server/creator-analytics-flow";

type CreatorAnalyticsProjectionMap = Record<string, CreatorAnalyticsSnapshot>;

export async function getCreatorAnalyticsSnapshotFromProjection(input?: {
  role?: "student" | "creator" | "admin";
  profileId?: string;
}): Promise<CreatorAnalyticsSnapshot> {
  const projectionStore = createDefaultProjectionStore();
  const projections =
    (await projectionStore.getJson<CreatorAnalyticsProjectionMap>(
      "stream:projection:creator-analytics:all",
    )) ?? {};

  if (input?.role === "creator" && input.profileId) {
    return (
      projections[input.profileId] ?? {
        publishedCourseCount: 0,
        publishedLessonCount: 0,
        averageDurationMin: 0,
        totalViews: 0,
        totalWatchTimeMin: 0,
        averageCompletionRate: 0,
        totalRebufferEvents: 0,
        totalFatalErrors: 0,
        averagePeerHitRatio: 0,
        lessons: [],
      }
    );
  }

  return (
    projections["admin:all"] ?? {
      publishedCourseCount: 0,
      publishedLessonCount: 0,
      averageDurationMin: 0,
      totalViews: 0,
      totalWatchTimeMin: 0,
      averageCompletionRate: 0,
      totalRebufferEvents: 0,
      totalFatalErrors: 0,
      averagePeerHitRatio: 0,
      lessons: [],
    }
  );
}

export async function getCreatorCourseAnalyticsSnapshotFromProjection(input: {
  courseId: string;
  role?: "student" | "creator" | "admin";
  profileId?: string;
}): Promise<CreatorCourseAnalyticsSnapshot> {
  const snapshot = await getCreatorAnalyticsSnapshotFromProjection({
    role: input.role,
    profileId: input.profileId,
  });
  const lessons = snapshot.lessons.filter((lesson) => lesson.courseId === input.courseId);

  return {
    courseId: input.courseId,
    totalViews: lessons.reduce((sum, lesson) => sum + lesson.views, 0),
    totalWatchTimeMin: lessons.reduce((sum, lesson) => sum + lesson.watchTimeMin, 0),
    averageCompletionRate: lessons.length
      ? Math.round(lessons.reduce((sum, lesson) => sum + lesson.completionRate, 0) / lessons.length)
      : 0,
    totalRebufferEvents: lessons.reduce((sum, lesson) => sum + lesson.rebufferEvents, 0),
    totalFatalErrors: lessons.reduce((sum, lesson) => sum + lesson.fatalErrors, 0),
    averagePeerHitRatio: lessons.length
      ? Math.round(lessons.reduce((sum, lesson) => sum + lesson.averagePeerHitRatio, 0) / lessons.length)
      : 0,
    lessons,
  };
}
