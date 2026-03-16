import type { ContinueWatchingItem } from "../contracts/catalog.ts";
import type { ActivityRepository } from "../repositories/activity-repository.ts";
import type { ContentRepository } from "../repositories/content-repository.ts";

export type DashboardSnapshot = {
  activeCourseCount: number;
  completedLessonCount: number;
  continueWatching: ContinueWatchingItem[];
};

export async function buildDashboardSnapshot(
  userId: string,
  repositories: {
    activityRepository: Pick<ActivityRepository, "listCourseEnrollmentsByUser" | "listLessonProgressByUser">;
    contentRepository: Pick<ContentRepository, "getCourseRecordById" | "getLessonRecordById">;
  },
): Promise<DashboardSnapshot> {
  const { activityRepository, contentRepository } = repositories;
  const [progressRecords, enrollments] = await Promise.all([
    activityRepository.listLessonProgressByUser(userId),
    activityRepository.listCourseEnrollmentsByUser(userId),
  ]);

  const continueWatching = (
    await Promise.all(
      progressRecords.map(async (progress) => {
        const lesson = await contentRepository.getLessonRecordById(progress.lessonId);
        if (!lesson || lesson.publishStatus !== "published") return null;

        const course = await contentRepository.getCourseRecordById(lesson.courseId);
        if (!course || course.publishStatus !== "published") return null;

        const remainingMin = Math.max(
          0,
          Math.ceil((lesson.durationMin * Math.max(0, 100 - progress.progressPercent)) / 100),
        );

        return {
          titleId: lesson.id,
          title: course.title,
          cardImageUrl: course.cardImageUrl,
          progressPercent: progress.progressPercent,
          remainingMin,
        } satisfies ContinueWatchingItem;
      }),
    )
  ).filter((item): item is ContinueWatchingItem => Boolean(item));

  return {
    activeCourseCount: enrollments.filter((item) => item.active).length,
    completedLessonCount: progressRecords.filter((item) => Boolean(item.completedAt)).length,
    continueWatching,
  };
}

export async function getDashboardSnapshot(userId: string): Promise<DashboardSnapshot> {
  const { getActivityRepository, getContentRepository } = await import("../repositories/index.ts");
  return buildDashboardSnapshot(userId, {
    activityRepository: getActivityRepository(),
    contentRepository: getContentRepository(),
  });
}
