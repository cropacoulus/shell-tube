import type { ActivityRepository } from "../repositories/activity-repository.ts";
import type { ContentRepository } from "../repositories/content-repository.ts";

export type CreatorLessonAnalytics = {
  lessonId: string;
  courseId: string;
  title: string;
  views: number;
  watchTimeMin: number;
  completionRate: number;
  rebufferEvents: number;
  fatalErrors: number;
  averagePeerHitRatio: number;
  publishStatus: "draft" | "published";
};

export type CreatorAnalyticsSnapshot = {
  publishedCourseCount: number;
  publishedLessonCount: number;
  averageDurationMin: number;
  totalViews: number;
  totalWatchTimeMin: number;
  averageCompletionRate: number;
  totalRebufferEvents: number;
  totalFatalErrors: number;
  averagePeerHitRatio: number;
  lessons: CreatorLessonAnalytics[];
};

export type CreatorCourseAnalyticsSnapshot = {
  courseId: string;
  totalViews: number;
  totalWatchTimeMin: number;
  averageCompletionRate: number;
  totalRebufferEvents: number;
  totalFatalErrors: number;
  averagePeerHitRatio: number;
  lessons: CreatorLessonAnalytics[];
};

export async function buildCreatorAnalyticsSnapshot(repositories: {
  activityRepository: Pick<ActivityRepository, "listAllLessonProgress" | "listAllPlaybackSessionRecords" | "listAllQoeEventRecords">;
  contentRepository: Pick<ContentRepository, "listCourseRecords" | "listLessonRecords">;
}, filter?: { creatorProfileId?: string; includeUnowned?: boolean }): Promise<CreatorAnalyticsSnapshot> {
  const { activityRepository, contentRepository } = repositories;
  const [courses, lessons, progressRecords, playbackSessions, qoeEvents] = await Promise.all([
    contentRepository.listCourseRecords(),
    contentRepository.listLessonRecords(),
    activityRepository.listAllLessonProgress(),
    activityRepository.listAllPlaybackSessionRecords(),
    activityRepository.listAllQoeEventRecords(),
  ]);

  const visibleCourses = courses.filter((course) => {
    if (!filter?.creatorProfileId) return true;
    if (course.creatorProfileId === filter.creatorProfileId) return true;
    return Boolean(filter.includeUnowned) && !course.creatorProfileId;
  });
  const visibleCourseIds = new Set(visibleCourses.map((course) => course.id));
  const visibleLessons = lessons.filter((lesson) => visibleCourseIds.has(lesson.courseId));
  const publishedCourses = visibleCourses.filter((course) => course.publishStatus === "published");
  const publishedLessons = visibleLessons.filter((lesson) => lesson.publishStatus === "published");
  const viewsByLessonId = new Map<string, number>();
  const watchTimeByLessonId = new Map<string, number>();
  const completionCountByLessonId = new Map<string, number>();
  const progressCountByLessonId = new Map<string, number>();
  const rebufferCountByLessonId = new Map<string, number>();
  const fatalCountByLessonId = new Map<string, number>();
  const peerHitRatioTotalByLessonId = new Map<string, number>();
  const peerHitRatioCountByLessonId = new Map<string, number>();

  for (const session of playbackSessions) {
    viewsByLessonId.set(session.lessonId, (viewsByLessonId.get(session.lessonId) ?? 0) + 1);
  }

  for (const progress of progressRecords) {
    watchTimeByLessonId.set(
      progress.lessonId,
      (watchTimeByLessonId.get(progress.lessonId) ?? 0) + Math.round(progress.lastPositionSec / 60),
    );
    progressCountByLessonId.set(progress.lessonId, (progressCountByLessonId.get(progress.lessonId) ?? 0) + 1);
    if (progress.completedAt) {
      completionCountByLessonId.set(
        progress.lessonId,
        (completionCountByLessonId.get(progress.lessonId) ?? 0) + 1,
      );
    }
  }

  for (const event of qoeEvents) {
    if (!visibleCourseIds.has(event.courseId)) continue;
    if (event.type === "rebuffer_start") {
      rebufferCountByLessonId.set(event.lessonId, (rebufferCountByLessonId.get(event.lessonId) ?? 0) + 1);
    }
    if (event.type === "fatal_error") {
      fatalCountByLessonId.set(event.lessonId, (fatalCountByLessonId.get(event.lessonId) ?? 0) + 1);
    }
    if (typeof event.peerHitRatio === "number") {
      peerHitRatioTotalByLessonId.set(
        event.lessonId,
        (peerHitRatioTotalByLessonId.get(event.lessonId) ?? 0) + event.peerHitRatio,
      );
      peerHitRatioCountByLessonId.set(
        event.lessonId,
        (peerHitRatioCountByLessonId.get(event.lessonId) ?? 0) + 1,
      );
    }
  }

  const lessonAnalytics = visibleLessons.map((lesson) => {
    const progressCount = progressCountByLessonId.get(lesson.id) ?? 0;
    const completionCount = completionCountByLessonId.get(lesson.id) ?? 0;
    const completionRate = progressCount > 0 ? Math.round((completionCount / progressCount) * 100) : 0;
    const peerHitRatioCount = peerHitRatioCountByLessonId.get(lesson.id) ?? 0;

    return {
      lessonId: lesson.id,
      courseId: lesson.courseId,
      title: lesson.title,
      views: viewsByLessonId.get(lesson.id) ?? 0,
      watchTimeMin: watchTimeByLessonId.get(lesson.id) ?? 0,
      completionRate,
      rebufferEvents: rebufferCountByLessonId.get(lesson.id) ?? 0,
      fatalErrors: fatalCountByLessonId.get(lesson.id) ?? 0,
      averagePeerHitRatio:
        peerHitRatioCount > 0
          ? Math.round((peerHitRatioTotalByLessonId.get(lesson.id) ?? 0) / peerHitRatioCount)
          : 0,
      publishStatus: lesson.publishStatus,
    } satisfies CreatorLessonAnalytics;
  });

  const averageDurationMin = publishedLessons.length
    ? Math.round(publishedLessons.reduce((sum, item) => sum + item.durationMin, 0) / publishedLessons.length)
    : 0;
  const totalViews = lessonAnalytics.reduce((sum, item) => sum + item.views, 0);
  const totalWatchTimeMin = lessonAnalytics.reduce((sum, item) => sum + item.watchTimeMin, 0);
  const averageCompletionRate = lessonAnalytics.length
    ? Math.round(lessonAnalytics.reduce((sum, item) => sum + item.completionRate, 0) / lessonAnalytics.length)
    : 0;
  const totalRebufferEvents = lessonAnalytics.reduce((sum, item) => sum + item.rebufferEvents, 0);
  const totalFatalErrors = lessonAnalytics.reduce((sum, item) => sum + item.fatalErrors, 0);
  const averagePeerHitRatio = lessonAnalytics.length
    ? Math.round(lessonAnalytics.reduce((sum, item) => sum + item.averagePeerHitRatio, 0) / lessonAnalytics.length)
    : 0;

  return {
    publishedCourseCount: publishedCourses.length,
    publishedLessonCount: publishedLessons.length,
    averageDurationMin,
    totalViews,
    totalWatchTimeMin,
    averageCompletionRate,
    totalRebufferEvents,
    totalFatalErrors,
    averagePeerHitRatio,
    lessons: lessonAnalytics.sort((left, right) => right.views - left.views || right.watchTimeMin - left.watchTimeMin),
  };
}

export async function getCreatorAnalyticsSnapshot(input?: {
  role?: "student" | "creator" | "admin";
  profileId?: string;
}): Promise<CreatorAnalyticsSnapshot> {
  const { getActivityRepository, getContentRepository } = await import("../repositories/index.ts");
  return buildCreatorAnalyticsSnapshot({
    activityRepository: getActivityRepository(),
    contentRepository: getContentRepository(),
  }, {
    creatorProfileId: input?.role === "creator" ? input.profileId : undefined,
    includeUnowned: input?.role === "admin",
  });
}

export async function getCreatorCourseAnalyticsSnapshot(input: {
  courseId: string;
  role?: "student" | "creator" | "admin";
  profileId?: string;
}): Promise<CreatorCourseAnalyticsSnapshot> {
  const snapshot = await getCreatorAnalyticsSnapshot({
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
