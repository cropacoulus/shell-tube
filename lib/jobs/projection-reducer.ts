import type { DomainEvent } from "../events/contracts";
import type { FilmCategory } from "../contracts/admin";
import type { UserProfile } from "../contracts/profile";

export type CategoryProjectionRecord = FilmCategory;

export type CreatorApplicationProjectionRecord = {
  applicationId: string;
  userId: string;
  displayName?: string;
  pitch?: string;
  status: "pending" | "approved" | "rejected";
  reviewedByUserId?: string;
  reviewedAt?: string;
  updatedAt: string;
};

export type PayoutProjectionRecord = {
  ledgerEntryId: string;
  creatorProfileId?: string;
  courseId?: string;
  courseTitle?: string;
  periodKey: string;
  amountUsd: number;
  currency: "USD";
  sourceType: "course_revenue" | "subscription_revenue_share";
  status: "projected" | "settled";
  formulaSnapshot: string;
  createdAt: string;
  updatedAt: string;
};

export type CatalogCourseProjectionRecord = {
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

export type CatalogLessonProjectionRecord = {
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

export type StudentDashboardProjection = {
  userId: string;
  activeCourseCount: number;
  completedLessonCount: number;
  continueWatching: Array<{
    titleId: string;
    title: string;
    cardImageUrl: string;
    progressPercent: number;
    remainingMin: number;
  }>;
};

export type ProgressProjectionRecord = {
  progressId: string;
  userId: string;
  profileId: string;
  lessonId: string;
  courseId: string;
  progressPercent: number;
  lastPositionSec: number;
  completedAt?: string;
  updatedAt: string;
};

export type PlaybackSessionProjectionRecord = {
  playbackSessionId: string;
  userId: string;
  profileId: string;
  lessonId: string;
  courseId: string;
  manifestBlobKey: string;
  entitlementSource: string;
  expiresAt: string;
  createdAt: string;
};

export type QoeEventProjectionRecord = {
  playbackSessionId: string;
  lessonId: string;
  courseId: string;
  userId: string;
  profileId: string;
  type: "startup" | "rebuffer_start" | "rebuffer_end" | "bitrate_change" | "fatal_error" | "playback_end";
  eventTs: string;
  positionMs: number;
  bitrateKbps?: number;
  rebufferMs?: number;
  peerHitRatio?: number;
  errorCode?: string;
  deviceId: string;
};

export type CreatorLessonAnalyticsProjectionRecord = {
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

export type CreatorAnalyticsProjection = {
  profileId: string;
  publishedCourseCount: number;
  publishedLessonCount: number;
  averageDurationMin: number;
  totalViews: number;
  totalWatchTimeMin: number;
  averageCompletionRate: number;
  totalRebufferEvents: number;
  totalFatalErrors: number;
  averagePeerHitRatio: number;
  lessons: CreatorLessonAnalyticsProjectionRecord[];
};

export type ProjectionReductionState = {
  categories: Record<string, CategoryProjectionRecord>;
  creatorApplications: Record<string, CreatorApplicationProjectionRecord>;
  profiles: Record<string, UserProfile>;
  creatorProfiles: Record<string, UserProfile>;
  payoutLedger: Record<string, PayoutProjectionRecord>;
  catalogCourses: Record<string, CatalogCourseProjectionRecord>;
  catalogLessons: Record<string, CatalogLessonProjectionRecord>;
  progressRecords: Record<string, ProgressProjectionRecord>;
  playbackSessions: Record<string, PlaybackSessionProjectionRecord>;
  qoeEvents: Record<string, QoeEventProjectionRecord>;
  studentDashboards: Record<string, StudentDashboardProjection>;
  creatorAnalytics: Record<string, CreatorAnalyticsProjection>;
  eventTypeCounts: Record<string, number>;
  appliedEvents: number;
  lastCursor: string | null;
};

export function sortProjectionEventsAscending(events: DomainEvent[]) {
  return [...events].sort(
    (left, right) =>
      left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id),
  );
}

export function applyProjectionEvents(
  current: Omit<ProjectionReductionState, "appliedEvents" | "lastCursor">,
  events: DomainEvent[],
): ProjectionReductionState {
  const creatorApplications = { ...current.creatorApplications };
  const categories = { ...current.categories };
  const profiles = { ...current.profiles };
  const creatorProfiles = { ...current.creatorProfiles };
  const payoutLedger = { ...current.payoutLedger };
  const catalogCourses = { ...current.catalogCourses };
  const catalogLessons = { ...current.catalogLessons };
  const progressRecords = { ...current.progressRecords };
  const playbackSessions = { ...current.playbackSessions };
  const qoeEvents = { ...current.qoeEvents };
  const studentDashboards = { ...current.studentDashboards };
  const creatorAnalytics = { ...current.creatorAnalytics };
  const eventTypeCounts = { ...current.eventTypeCounts };

  let appliedEvents = 0;
  let lastCursor: string | null = null;

  for (const event of events) {
    eventTypeCounts[event.type] = (eventTypeCounts[event.type] ?? 0) + 1;

    switch (event.type) {
      case "category_created":
      case "category_updated": {
        const payload = event.payload as CategoryProjectionRecord;
        categories[payload.id] = payload;
        appliedEvents += 1;
        break;
      }
      case "category_deleted": {
        const payload = event.payload as { id: string };
        delete categories[payload.id];
        appliedEvents += 1;
        break;
      }
      case "creator_application_submitted": {
        const payload = event.payload as {
          applicationId: string;
          userId: string;
          displayName?: string;
          pitch?: string;
          status: "pending";
          updatedAt: string;
        };
        creatorApplications[payload.applicationId] = {
          applicationId: payload.applicationId,
          userId: payload.userId,
          displayName: payload.displayName,
          pitch: payload.pitch,
          status: payload.status,
          updatedAt: payload.updatedAt,
        };
        appliedEvents += 1;
        break;
      }
      case "creator_application_approved":
      case "creator_application_rejected": {
        const payload = event.payload as {
          applicationId: string;
          userId: string;
          status: "approved" | "rejected";
          reviewedByUserId?: string;
          reviewedAt?: string;
          updatedAt: string;
        };
        const currentRecord = creatorApplications[payload.applicationId];
        creatorApplications[payload.applicationId] = {
          applicationId: payload.applicationId,
          userId: payload.userId,
          displayName: currentRecord?.displayName,
          pitch: currentRecord?.pitch,
          status: payload.status,
          reviewedByUserId: payload.reviewedByUserId,
          reviewedAt: payload.reviewedAt,
          updatedAt: payload.updatedAt,
        };
        appliedEvents += 1;
        break;
      }
      case "payout_projected":
      case "payout_settled": {
        const payload = event.payload as PayoutProjectionRecord;
        payoutLedger[payload.ledgerEntryId] = payload;
        appliedEvents += 1;
        break;
      }
      case "profile_updated": {
        const payload = event.payload as UserProfile;
        profiles[payload.userId] = payload;
        if (payload.role === "creator") {
          creatorProfiles[payload.userId] = payload;
        } else {
          delete creatorProfiles[payload.userId];
        }
        appliedEvents += 1;
        break;
      }
      case "course_created":
      case "course_updated": {
        const payload = event.payload as CatalogCourseProjectionRecord;
        catalogCourses[payload.courseId] = payload;
        appliedEvents += 1;
        break;
      }
      case "lesson_created":
      case "lesson_updated":
      case "lesson_published":
      case "lesson_unpublished": {
        const payload = event.payload as CatalogLessonProjectionRecord;
        catalogLessons[payload.lessonId] = {
          ...payload,
          processingStatus:
            payload.processingStatus ??
            (payload.manifestBlobKey
              ? "manifest_ready"
              : payload.streamAssetId
                ? "source_uploaded"
                : "idle"),
        };
        appliedEvents += 1;
        break;
      }
      case "lesson_manifest_attached": {
        const payload = event.payload as {
          lessonId: string;
          courseId: string;
          manifestBlobKey: string;
          streamAssetId?: string;
          updatedAt: string;
        };
        const current = catalogLessons[payload.lessonId];
        if (current) {
          catalogLessons[payload.lessonId] = {
            ...current,
            courseId: payload.courseId,
            manifestBlobKey: payload.manifestBlobKey,
            streamAssetId: payload.streamAssetId ?? current.streamAssetId,
            processingStatus: "manifest_ready",
            updatedAt: payload.updatedAt,
          };
          appliedEvents += 1;
        }
        break;
      }
      case "lesson_asset_attached": {
        const payload = event.payload as {
          lessonId: string;
          courseId: string;
          streamAssetId?: string;
          updatedAt: string;
        };
        const current = catalogLessons[payload.lessonId];
        if (current) {
          catalogLessons[payload.lessonId] = {
            ...current,
            courseId: payload.courseId,
            streamAssetId: payload.streamAssetId ?? current.streamAssetId,
            processingStatus: payload.streamAssetId ? "source_uploaded" : current.processingStatus,
            updatedAt: payload.updatedAt,
          };
          appliedEvents += 1;
        }
        break;
      }
      case "lesson_processing_requested": {
        const payload = event.payload as {
          lessonId: string;
          courseId: string;
          updatedAt: string;
        };
        const current = catalogLessons[payload.lessonId];
        if (current) {
          catalogLessons[payload.lessonId] = {
            ...current,
            courseId: payload.courseId,
            processingStatus: "packaging_requested",
            updatedAt: payload.updatedAt,
          };
          appliedEvents += 1;
        }
        break;
      }
      case "progress_checkpoint_recorded":
      case "lesson_completed": {
        const payload = event.payload as ProgressProjectionRecord;
        const currentRecord = progressRecords[payload.progressId];
        progressRecords[payload.progressId] = {
          ...currentRecord,
          ...payload,
        };
        appliedEvents += 1;
        break;
      }
      case "playback_session_created": {
        const payload = event.payload as PlaybackSessionProjectionRecord;
        playbackSessions[payload.playbackSessionId] = payload;
        appliedEvents += 1;
        break;
      }
      case "qoe_event_recorded": {
        const payload = event.payload as QoeEventProjectionRecord;
        qoeEvents[`${payload.playbackSessionId}:${payload.eventTs}:${payload.type}:${payload.positionMs}`] = payload;
        appliedEvents += 1;
        break;
      }
      case "course_deleted": {
        const payload = event.payload as { courseId: string };
        delete catalogCourses[payload.courseId];
        for (const lessonId of Object.keys(catalogLessons)) {
          if (catalogLessons[lessonId]?.courseId === payload.courseId) {
            delete catalogLessons[lessonId];
          }
        }
        appliedEvents += 1;
        break;
      }
      case "lesson_deleted": {
        const payload = event.payload as { lessonId: string };
        delete catalogLessons[payload.lessonId];
        appliedEvents += 1;
        break;
      }
      default:
        break;
    }

    lastCursor = event.occurredAt;
  }

  return {
    categories,
    creatorApplications,
    profiles,
    creatorProfiles,
    payoutLedger,
    catalogCourses,
    catalogLessons,
    progressRecords,
    playbackSessions,
    qoeEvents,
    studentDashboards,
    creatorAnalytics,
    eventTypeCounts,
    appliedEvents,
    lastCursor,
  };
}

export function buildStudentDashboardProjections(input: {
  catalogCourses: Record<string, CatalogCourseProjectionRecord>;
  catalogLessons: Record<string, CatalogLessonProjectionRecord>;
  progressRecords: Record<string, ProgressProjectionRecord>;
}): Record<string, StudentDashboardProjection> {
  const result: Record<string, StudentDashboardProjection> = {};
  const progressByUser = new Map<string, ProgressProjectionRecord[]>();

  for (const record of Object.values(input.progressRecords)) {
    const list = progressByUser.get(record.userId) ?? [];
    list.push(record);
    progressByUser.set(record.userId, list);
  }

  for (const [userId, items] of progressByUser.entries()) {
    const visibleProgress = items
      .filter((item) => {
        const lesson = input.catalogLessons[item.lessonId];
        const course = input.catalogCourses[item.courseId];
        return Boolean(
          lesson &&
          course &&
          lesson.publishStatus === "published" &&
          course.publishStatus === "published",
        );
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

    const activeCourseIds = new Set(
      visibleProgress
        .filter((item) => item.progressPercent > 0)
        .map((item) => item.courseId),
    );

    result[userId] = {
      userId,
      activeCourseCount: activeCourseIds.size,
      completedLessonCount: visibleProgress.filter((item) => Boolean(item.completedAt)).length,
      continueWatching: visibleProgress
        .filter((item) => item.progressPercent > 0 && item.progressPercent < 100)
        .slice(0, 12)
        .map((item) => {
          const lesson = input.catalogLessons[item.lessonId]!;
          const course = input.catalogCourses[item.courseId]!;
          const remainingMin = Math.max(
            0,
            Math.ceil((lesson.durationMin * Math.max(0, 100 - item.progressPercent)) / 100),
          );
          return {
            titleId: lesson.lessonId,
            title: course.title,
            cardImageUrl: course.cardImageUrl || course.heroImageUrl,
            progressPercent: item.progressPercent,
            remainingMin,
          };
        }),
    };
  }

  return result;
}

export function buildCreatorAnalyticsProjections(input: {
  catalogCourses: Record<string, CatalogCourseProjectionRecord>;
  catalogLessons: Record<string, CatalogLessonProjectionRecord>;
  playbackSessions: Record<string, PlaybackSessionProjectionRecord>;
  progressRecords: Record<string, ProgressProjectionRecord>;
  qoeEvents: Record<string, QoeEventProjectionRecord>;
}): Record<string, CreatorAnalyticsProjection> {
  const courses = Object.values(input.catalogCourses);
  const lessons = Object.values(input.catalogLessons);
  const progressRecords = Object.values(input.progressRecords);
  const playbackSessions = Object.values(input.playbackSessions);
  const qoeEvents = Object.values(input.qoeEvents);

  const creatorIds = [
    "admin:all",
    ...new Set(
      courses
        .map((course) => course.creatorProfileId)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const result: Record<string, CreatorAnalyticsProjection> = {};

  for (const creatorId of creatorIds) {
    const visibleCourses = courses.filter((course) =>
      creatorId === "admin:all" ? true : course.creatorProfileId === creatorId,
    );
    const visibleCourseIds = new Set(visibleCourses.map((course) => course.courseId));
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
      if (!visibleCourseIds.has(session.courseId)) continue;
      viewsByLessonId.set(session.lessonId, (viewsByLessonId.get(session.lessonId) ?? 0) + 1);
    }

    for (const progress of progressRecords) {
      if (!visibleCourseIds.has(progress.courseId)) continue;
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
      const progressCount = progressCountByLessonId.get(lesson.lessonId) ?? 0;
      const completionCount = completionCountByLessonId.get(lesson.lessonId) ?? 0;
      const peerHitRatioCount = peerHitRatioCountByLessonId.get(lesson.lessonId) ?? 0;

      return {
        lessonId: lesson.lessonId,
        courseId: lesson.courseId,
        title: lesson.title,
        views: viewsByLessonId.get(lesson.lessonId) ?? 0,
        watchTimeMin: watchTimeByLessonId.get(lesson.lessonId) ?? 0,
        completionRate: progressCount > 0 ? Math.round((completionCount / progressCount) * 100) : 0,
        rebufferEvents: rebufferCountByLessonId.get(lesson.lessonId) ?? 0,
        fatalErrors: fatalCountByLessonId.get(lesson.lessonId) ?? 0,
        averagePeerHitRatio:
          peerHitRatioCount > 0
            ? Math.round((peerHitRatioTotalByLessonId.get(lesson.lessonId) ?? 0) / peerHitRatioCount)
            : 0,
        publishStatus: lesson.publishStatus,
      };
    });

    result[creatorId] = {
      profileId: creatorId,
      publishedCourseCount: publishedCourses.length,
      publishedLessonCount: publishedLessons.length,
      averageDurationMin: publishedLessons.length
        ? Math.round(publishedLessons.reduce((sum, item) => sum + item.durationMin, 0) / publishedLessons.length)
        : 0,
      totalViews: lessonAnalytics.reduce((sum, item) => sum + item.views, 0),
      totalWatchTimeMin: lessonAnalytics.reduce((sum, item) => sum + item.watchTimeMin, 0),
      averageCompletionRate: lessonAnalytics.length
        ? Math.round(lessonAnalytics.reduce((sum, item) => sum + item.completionRate, 0) / lessonAnalytics.length)
        : 0,
      totalRebufferEvents: lessonAnalytics.reduce((sum, item) => sum + item.rebufferEvents, 0),
      totalFatalErrors: lessonAnalytics.reduce((sum, item) => sum + item.fatalErrors, 0),
      averagePeerHitRatio: lessonAnalytics.length
        ? Math.round(lessonAnalytics.reduce((sum, item) => sum + item.averagePeerHitRatio, 0) / lessonAnalytics.length)
        : 0,
      lessons: lessonAnalytics.sort((left, right) => right.views - left.views || right.watchTimeMin - left.watchTimeMin),
    };
  }

  return result;
}
