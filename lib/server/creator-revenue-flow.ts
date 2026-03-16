import type { ActivityRepository } from "../repositories/activity-repository.ts";
import type { ContentRepository } from "../repositories/content-repository.ts";
import type { CreatorPayoutLedgerRecord, RevenueSourceType } from "../contracts/revenue.ts";

const MOCK_SUBSCRIPTION_POOL_NET_USD = 1000;
const MOCK_COURSE_PURCHASE_PRICE_USD = 49;
const CREATOR_COURSE_PURCHASE_SPLIT = 0.7;

export type CreatorPayoutLedgerEntry = CreatorPayoutLedgerRecord;

export type CreatorRevenueSnapshot = {
  projectedSubscriptionShareUsd: number;
  projectedCourseRevenueUsd: number;
  totalProjectedRevenueUsd: number;
  settledSubscriptionShareUsd: number;
  settledCourseRevenueUsd: number;
  totalSettledRevenueUsd: number;
  payoutLedger: CreatorPayoutLedgerEntry[];
};

export type CreatorCourseRevenueSnapshot = CreatorRevenueSnapshot & {
  courseId: string;
};

function roundUsd(value: number): number {
  return Math.round(value * 100) / 100;
}

function toPeriodKey(now: Date): string {
  return now.toISOString().slice(0, 7);
}

function buildLedgerEntry(input: {
  creatorProfileId?: string;
  courseId?: string;
  courseTitle?: string;
  periodKey: string;
  amountUsd: number;
  sourceType: RevenueSourceType;
  formulaSnapshot: Record<string, unknown>;
  createdAt: string;
}): CreatorPayoutLedgerEntry {
  return {
    id: `ledger_${crypto.randomUUID().slice(0, 8)}`,
    creatorProfileId: input.creatorProfileId,
    courseId: input.courseId,
    courseTitle: input.courseTitle,
    periodKey: input.periodKey,
    amountUsd: roundUsd(input.amountUsd),
    currency: "USD",
    sourceType: input.sourceType,
    status: "projected",
    formulaSnapshot: JSON.stringify(input.formulaSnapshot),
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
}

export async function buildProjectedCreatorRevenueSnapshot(repositories: {
  activityRepository: Pick<ActivityRepository, "listAllLessonProgress">;
  contentRepository: Pick<ContentRepository, "listCourseRecords" | "listLessonRecords">;
}, filter?: { creatorProfileId?: string; includeUnowned?: boolean; courseId?: string; now?: Date }): Promise<CreatorRevenueSnapshot> {
  const { activityRepository, contentRepository } = repositories;
  const [courses, lessons, progressRecords] = await Promise.all([
    contentRepository.listCourseRecords(),
    contentRepository.listLessonRecords(),
    activityRepository.listAllLessonProgress(),
  ]);

  const now = filter?.now ?? new Date();
  const periodKey = toPeriodKey(now);
  const createdAt = now.toISOString();
  const totalPlatformWatchSec = progressRecords.reduce((sum, item) => sum + item.lastPositionSec, 0);
  const visibleCourses = courses.filter((course) => {
    if (course.publishStatus !== "published") return false;
    if (filter?.courseId && course.id !== filter.courseId) return false;
    if (!filter?.creatorProfileId) return true;
    if (course.creatorProfileId === filter.creatorProfileId) return true;
    return Boolean(filter.includeUnowned) && !course.creatorProfileId;
  });
  const visibleCourseIds = new Set(visibleCourses.map((course) => course.id));
  const publishedLessonIds = new Set(
    lessons
      .filter((lesson) => lesson.publishStatus === "published" && visibleCourseIds.has(lesson.courseId))
      .map((lesson) => lesson.id),
  );

  const ledger = visibleCourses.flatMap((course) => {
    const courseProgress = progressRecords.filter(
      (progress) => progress.courseId === course.id && publishedLessonIds.has(progress.lessonId),
    );
    const courseWatchSec = courseProgress.reduce((sum, item) => sum + item.lastPositionSec, 0);
    const distinctCompletedUsers = new Set(
      courseProgress.filter((item) => item.completedAt).map((item) => item.userId),
    ).size;
    const subscriptionShareUsd =
      totalPlatformWatchSec > 0
        ? roundUsd((courseWatchSec / totalPlatformWatchSec) * MOCK_SUBSCRIPTION_POOL_NET_USD)
        : 0;
    const courseRevenueUsd = roundUsd(
      distinctCompletedUsers * MOCK_COURSE_PURCHASE_PRICE_USD * CREATOR_COURSE_PURCHASE_SPLIT,
    );

    const entries: CreatorPayoutLedgerEntry[] = [];
    if (subscriptionShareUsd > 0) {
      entries.push(
        buildLedgerEntry({
          creatorProfileId: course.creatorProfileId,
          courseId: course.id,
          courseTitle: course.title,
          periodKey,
          amountUsd: subscriptionShareUsd,
          sourceType: "subscription_revenue_share",
          formulaSnapshot: {
            model: "placeholder_watch_time_share",
            subscription_pool_net_usd: MOCK_SUBSCRIPTION_POOL_NET_USD,
            course_watch_time_sec: courseWatchSec,
            total_platform_watch_time_sec: totalPlatformWatchSec,
            watch_time_share: totalPlatformWatchSec > 0 ? roundUsd(courseWatchSec / totalPlatformWatchSec) : 0,
          },
          createdAt,
        }),
      );
    }
    if (courseRevenueUsd > 0) {
      entries.push(
        buildLedgerEntry({
          creatorProfileId: course.creatorProfileId,
          courseId: course.id,
          courseTitle: course.title,
          periodKey,
          amountUsd: courseRevenueUsd,
          sourceType: "course_revenue",
          formulaSnapshot: {
            model: "placeholder_completion_proxy",
            completed_users: distinctCompletedUsers,
            mock_course_price_usd: MOCK_COURSE_PURCHASE_PRICE_USD,
            creator_split: CREATOR_COURSE_PURCHASE_SPLIT,
          },
          createdAt,
        }),
      );
    }

    return entries;
  });

  const projectedSubscriptionShareUsd = roundUsd(
    ledger
      .filter((entry) => entry.sourceType === "subscription_revenue_share")
      .reduce((sum, entry) => sum + entry.amountUsd, 0),
  );
  const projectedCourseRevenueUsd = roundUsd(
    ledger
      .filter((entry) => entry.sourceType === "course_revenue")
      .reduce((sum, entry) => sum + entry.amountUsd, 0),
  );

  return {
    projectedSubscriptionShareUsd,
    projectedCourseRevenueUsd,
    totalProjectedRevenueUsd: roundUsd(projectedSubscriptionShareUsd + projectedCourseRevenueUsd),
    settledSubscriptionShareUsd: 0,
    settledCourseRevenueUsd: 0,
    totalSettledRevenueUsd: 0,
    payoutLedger: ledger.sort((left, right) => right.amountUsd - left.amountUsd || left.sourceType.localeCompare(right.sourceType)),
  };
}

export const buildCreatorRevenueSnapshot = buildProjectedCreatorRevenueSnapshot;

export async function getCreatorRevenueSnapshot(input?: {
  role?: "student" | "creator" | "admin";
  profileId?: string;
}): Promise<CreatorRevenueSnapshot> {
  const { getRevenueRepository } = await import("../repositories/index.ts");
  const payoutLedger = (await getRevenueRepository().listCreatorPayoutLedger()).filter((entry) => {
    if (input?.role === "creator") return entry.creatorProfileId === input.profileId;
    return true;
  });
  return summarizeRevenueLedger(payoutLedger);
}

function summarizeRevenueLedger(payoutLedger: CreatorPayoutLedgerEntry[]): CreatorRevenueSnapshot {
  const projectedSubscriptionShareUsd = roundUsd(
    payoutLedger
      .filter((entry) => entry.sourceType === "subscription_revenue_share" && entry.status === "projected")
      .reduce((sum, entry) => sum + entry.amountUsd, 0),
  );
  const projectedCourseRevenueUsd = roundUsd(
    payoutLedger
      .filter((entry) => entry.sourceType === "course_revenue" && entry.status === "projected")
      .reduce((sum, entry) => sum + entry.amountUsd, 0),
  );
  const settledSubscriptionShareUsd = roundUsd(
    payoutLedger
      .filter((entry) => entry.sourceType === "subscription_revenue_share" && entry.status === "settled")
      .reduce((sum, entry) => sum + entry.amountUsd, 0),
  );
  const settledCourseRevenueUsd = roundUsd(
    payoutLedger
      .filter((entry) => entry.sourceType === "course_revenue" && entry.status === "settled")
      .reduce((sum, entry) => sum + entry.amountUsd, 0),
  );

  return {
    projectedSubscriptionShareUsd,
    projectedCourseRevenueUsd,
    totalProjectedRevenueUsd: roundUsd(projectedSubscriptionShareUsd + projectedCourseRevenueUsd),
    settledSubscriptionShareUsd,
    settledCourseRevenueUsd,
    totalSettledRevenueUsd: roundUsd(settledSubscriptionShareUsd + settledCourseRevenueUsd),
    payoutLedger: payoutLedger.sort((left, right) => right.amountUsd - left.amountUsd || left.sourceType.localeCompare(right.sourceType)),
  };
}

export async function syncCreatorRevenueLedger(input?: {
  role?: "student" | "creator" | "admin";
  profileId?: string;
}): Promise<CreatorRevenueSnapshot> {
  const { getActivityRepository, getContentRepository, getRevenueRepository } = await import("../repositories/index.ts");
  const projected = await buildProjectedCreatorRevenueSnapshot(
    {
      activityRepository: getActivityRepository(),
      contentRepository: getContentRepository(),
    },
    {
      creatorProfileId: input?.role === "creator" ? input.profileId : undefined,
      includeUnowned: input?.role === "admin",
    },
  );
  const revenueRepository = getRevenueRepository();
  await Promise.all(
    projected.payoutLedger.map((entry) =>
      revenueRepository.upsertCreatorPayoutLedgerRecord({
        creatorProfileId: entry.creatorProfileId,
        courseId: entry.courseId,
        courseTitle: entry.courseTitle,
        periodKey: entry.periodKey,
        amountUsd: entry.amountUsd,
        currency: entry.currency,
        sourceType: entry.sourceType,
        status: entry.status,
        formulaSnapshot: entry.formulaSnapshot,
        createdAt: entry.createdAt,
      }),
    ),
  );
  return getCreatorRevenueSnapshot(input);
}

export async function getCreatorCourseRevenueSnapshot(input: {
  courseId: string;
  role?: "student" | "creator" | "admin";
  profileId?: string;
}): Promise<CreatorCourseRevenueSnapshot> {
  const snapshot = await getCreatorRevenueSnapshot({
    role: input.role,
    profileId: input.profileId,
  });
  const payoutLedger = snapshot.payoutLedger.filter((entry) => entry.courseId === input.courseId);
  const projectedSubscriptionShareUsd = roundUsd(
    payoutLedger
      .filter((entry) => entry.sourceType === "subscription_revenue_share")
      .reduce((sum, entry) => sum + entry.amountUsd, 0),
  );
  const projectedCourseRevenueUsd = roundUsd(
    payoutLedger
      .filter((entry) => entry.sourceType === "course_revenue")
      .reduce((sum, entry) => sum + entry.amountUsd, 0),
  );

  return {
    courseId: input.courseId,
    projectedSubscriptionShareUsd,
    projectedCourseRevenueUsd,
    totalProjectedRevenueUsd: roundUsd(projectedSubscriptionShareUsd + projectedCourseRevenueUsd),
    settledSubscriptionShareUsd: roundUsd(
      payoutLedger
        .filter((entry) => entry.sourceType === "subscription_revenue_share" && entry.status === "settled")
        .reduce((sum, entry) => sum + entry.amountUsd, 0),
    ),
    settledCourseRevenueUsd: roundUsd(
      payoutLedger
        .filter((entry) => entry.sourceType === "course_revenue" && entry.status === "settled")
        .reduce((sum, entry) => sum + entry.amountUsd, 0),
    ),
    totalSettledRevenueUsd: roundUsd(
      payoutLedger
        .filter((entry) => entry.status === "settled")
        .reduce((sum, entry) => sum + entry.amountUsd, 0),
    ),
    payoutLedger,
  };
}
