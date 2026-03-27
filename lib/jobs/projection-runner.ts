import { getEventStore } from "@/lib/repositories";
import { createDefaultProjectionStore } from "@/lib/projection-store";
import {
  applyProjectionEvents,
  buildCreatorAnalyticsProjections,
  buildStudentDashboardProjections,
  type CategoryProjectionRecord,
  type CatalogCourseProjectionRecord,
  type CatalogLessonProjectionRecord,
  type CreatorAnalyticsProjection,
  type PlaybackSessionProjectionRecord,
  type ProgressProjectionRecord,
  type QoeEventProjectionRecord,
  sortProjectionEventsAscending,
  type CreatorApplicationProjectionRecord,
  type PayoutProjectionRecord,
  type StudentDashboardProjection,
} from "@/lib/jobs/projection-reducer";
import type { UserProfile } from "@/lib/contracts/profile";

const CURSOR_NAME = "default";
const CREATOR_APPLICATIONS_KEY = "stream:projection:creator-application:all";
const CREATOR_APPLICATIONS_PENDING_KEY = "stream:projection:creator-application:index:pending";
const CREATOR_APPLICATIONS_APPROVED_KEY = "stream:projection:creator-application:index:approved";
const CATEGORIES_KEY = "stream:projection:category:all";
const PROFILES_KEY = "stream:projection:profile:all";
const CREATOR_PROFILES_KEY = "stream:projection:profile:index:creators";
const PAYOUT_LEDGER_KEY = "stream:projection:payout:all";
const CATALOG_COURSES_KEY = "stream:projection:catalog:courses";
const CATALOG_LESSONS_KEY = "stream:projection:catalog:lessons";
const STUDENT_DASHBOARDS_KEY = "stream:projection:student-dashboard:all";
const CREATOR_ANALYTICS_KEY = "stream:projection:creator-analytics:all";
const OPS_COUNTS_KEY = "stream:projection:ops:event-counts";

type ProjectionRunResult = {
  processedEvents: number;
  appliedEvents: number;
  lastCursor: string | null;
  eventTypeCounts: Record<string, number>;
};

export async function runProjectionBatch(limit = 200): Promise<ProjectionRunResult> {
  const eventStore = getEventStore();
  const projectionStore = createDefaultProjectionStore();
  const cursor = await projectionStore.getCursor(CURSOR_NAME);
  const allEvents = await eventStore.listEvents({ limit });
  const orderedEvents = sortProjectionEventsAscending(allEvents);
  const pendingEvents = cursor
    ? orderedEvents.filter((event) => event.occurredAt > cursor)
    : orderedEvents;

  const creatorApplications =
    (await projectionStore.getJson<Record<string, CreatorApplicationProjectionRecord>>(
      CREATOR_APPLICATIONS_KEY,
    )) ?? {};
  const categories =
    (await projectionStore.getJson<Record<string, CategoryProjectionRecord>>(CATEGORIES_KEY)) ?? {};
  const payoutLedger =
    (await projectionStore.getJson<Record<string, PayoutProjectionRecord>>(PAYOUT_LEDGER_KEY)) ?? {};
  const catalogCourses =
    (await projectionStore.getJson<Record<string, CatalogCourseProjectionRecord>>(CATALOG_COURSES_KEY)) ?? {};
  const catalogLessons =
    (await projectionStore.getJson<Record<string, CatalogLessonProjectionRecord>>(CATALOG_LESSONS_KEY)) ?? {};
  const progressRecords =
    (await projectionStore.getJson<Record<string, ProgressProjectionRecord>>("stream:projection:activity:progress")) ?? {};
  const playbackSessions =
    (await projectionStore.getJson<Record<string, PlaybackSessionProjectionRecord>>("stream:projection:activity:playback")) ?? {};
  const qoeEvents =
    (await projectionStore.getJson<Record<string, QoeEventProjectionRecord>>("stream:projection:activity:qoe")) ?? {};
  const studentDashboards =
    (await projectionStore.getJson<Record<string, StudentDashboardProjection>>(STUDENT_DASHBOARDS_KEY)) ?? {};
  const creatorAnalytics =
    (await projectionStore.getJson<Record<string, CreatorAnalyticsProjection>>(CREATOR_ANALYTICS_KEY)) ?? {};
  const profiles =
    (await projectionStore.getJson<Record<string, UserProfile>>(PROFILES_KEY)) ?? {};
  const creatorProfiles =
    (await projectionStore.getJson<Record<string, UserProfile>>(CREATOR_PROFILES_KEY)) ?? {};
  const eventTypeCounts =
    (await projectionStore.getJson<Record<string, number>>(OPS_COUNTS_KEY)) ?? {};

  const reduction = applyProjectionEvents(
    {
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
    },
    pendingEvents,
  );

  const creatorApplicationList = Object.values(reduction.creatorApplications).sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
  const studentDashboardsMap = buildStudentDashboardProjections({
    catalogCourses: reduction.catalogCourses,
    catalogLessons: reduction.catalogLessons,
    progressRecords: reduction.progressRecords,
  });
  const creatorAnalyticsMap = buildCreatorAnalyticsProjections({
    catalogCourses: reduction.catalogCourses,
    catalogLessons: reduction.catalogLessons,
    playbackSessions: reduction.playbackSessions,
    progressRecords: reduction.progressRecords,
    qoeEvents: reduction.qoeEvents,
  });

  await projectionStore.setJson(CREATOR_APPLICATIONS_KEY, reduction.creatorApplications);
  await projectionStore.setJson(CATEGORIES_KEY, reduction.categories);
  await projectionStore.setJson(
    CREATOR_APPLICATIONS_PENDING_KEY,
    creatorApplicationList.filter((item) => item.status === "pending").map((item) => item.applicationId),
  );
  await projectionStore.setJson(
    CREATOR_APPLICATIONS_APPROVED_KEY,
    creatorApplicationList.filter((item) => item.status === "approved").map((item) => item.applicationId),
  );
  await projectionStore.setJson(PROFILES_KEY, reduction.profiles);
  await projectionStore.setJson(CREATOR_PROFILES_KEY, reduction.creatorProfiles);
  await projectionStore.setJson(PAYOUT_LEDGER_KEY, reduction.payoutLedger);
  await projectionStore.setJson(CATALOG_COURSES_KEY, reduction.catalogCourses);
  await projectionStore.setJson(CATALOG_LESSONS_KEY, reduction.catalogLessons);
  await projectionStore.setJson("stream:projection:activity:progress", reduction.progressRecords);
  await projectionStore.setJson("stream:projection:activity:playback", reduction.playbackSessions);
  await projectionStore.setJson("stream:projection:activity:qoe", reduction.qoeEvents);
  await projectionStore.setJson(STUDENT_DASHBOARDS_KEY, studentDashboardsMap);
  await projectionStore.setJson(CREATOR_ANALYTICS_KEY, creatorAnalyticsMap);
  await projectionStore.setJson(OPS_COUNTS_KEY, reduction.eventTypeCounts);

  if (reduction.lastCursor) {
    await projectionStore.setCursor(CURSOR_NAME, reduction.lastCursor);
  }

  return {
    processedEvents: pendingEvents.length,
    appliedEvents: reduction.appliedEvents,
    lastCursor: reduction.lastCursor,
    eventTypeCounts: reduction.eventTypeCounts,
  };
}
