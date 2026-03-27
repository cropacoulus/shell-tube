import assert from "node:assert/strict";
import test from "node:test";

import { createDomainEvent } from "../lib/events/event-factory.ts";
import {
  applyProjectionEvents,
  buildCreatorAnalyticsProjections,
  buildStudentDashboardProjections,
} from "../lib/jobs/projection-reducer.ts";

function createEmptyProjectionState() {
  return {
    categories: {},
    creatorApplications: {},
    profiles: {},
    creatorProfiles: {},
    payoutLedger: {},
    catalogCourses: {},
    catalogLessons: {},
    progressRecords: {},
    playbackSessions: {},
    qoeEvents: {},
    studentDashboards: {},
    creatorAnalytics: {},
    eventTypeCounts: {},
  };
}

test("applyProjectionEvents projects creator applications and payouts", () => {
  const reduced = applyProjectionEvents(
    createEmptyProjectionState(),
    [
      createDomainEvent({
        type: "creator_application_submitted",
        aggregateType: "creator_application",
        aggregateId: "creator_app_1",
        payload: {
          applicationId: "creator_app_1",
          userId: "user_1",
          displayName: "Rifqi",
          pitch: "I want to publish courses",
          status: "pending" as const,
          createdAt: "2026-03-26T00:00:00.000Z",
          updatedAt: "2026-03-26T00:00:00.000Z",
        },
      }),
      createDomainEvent({
        type: "payout_projected",
        aggregateType: "payout_ledger",
        aggregateId: "ledger_1",
        payload: {
          ledgerEntryId: "ledger_1",
          creatorProfileId: "user_1",
          courseId: "course_1",
          courseTitle: "Course 1",
          periodKey: "2026-03",
          amountUsd: 120,
          currency: "USD" as const,
          sourceType: "subscription_revenue_share" as const,
          status: "projected" as const,
          formulaSnapshot: "{\"mode\":\"test\"}",
          createdAt: "2026-03-26T00:00:00.000Z",
          updatedAt: "2026-03-26T00:00:00.000Z",
        },
      }),
    ],
  );

  assert.equal(reduced.creatorApplications.creator_app_1?.status, "pending");
  assert.equal(reduced.payoutLedger.ledger_1?.amountUsd, 120);
  assert.equal(reduced.eventTypeCounts.creator_application_submitted, 1);
  assert.equal(reduced.eventTypeCounts.payout_projected, 1);
  assert.equal(reduced.appliedEvents, 2);
});

test("applyProjectionEvents projects category lifecycle", () => {
  const reduced = applyProjectionEvents(
    createEmptyProjectionState(),
    [
      createDomainEvent({
        type: "category_created",
        aggregateType: "category",
        aggregateId: "cat_1",
        payload: {
          id: "cat_1",
          name: "Programming",
          description: "Coding courses",
          createdAt: "2026-03-26T00:00:00.000Z",
        },
      }),
      createDomainEvent({
        type: "category_updated",
        aggregateType: "category",
        aggregateId: "cat_1",
        payload: {
          id: "cat_1",
          name: "Software Engineering",
          description: "Coding courses",
          createdAt: "2026-03-26T00:00:00.000Z",
        },
      }),
      createDomainEvent({
        type: "category_deleted",
        aggregateType: "category",
        aggregateId: "cat_1",
        payload: {
          id: "cat_1",
        },
      }),
    ],
  );

  assert.equal(reduced.categories.cat_1, undefined);
  assert.equal(reduced.eventTypeCounts.category_created, 1);
  assert.equal(reduced.eventTypeCounts.category_updated, 1);
  assert.equal(reduced.eventTypeCounts.category_deleted, 1);
});

test("applyProjectionEvents projects catalog lifecycle", () => {
  const reduced = applyProjectionEvents(
    createEmptyProjectionState(),
    [
      createDomainEvent({
        type: "course_created",
        aggregateType: "course",
        aggregateId: "course_1",
        payload: {
          courseId: "course_1",
          creatorProfileId: "creator_1",
          title: "Course 1",
          synopsis: "Course synopsis",
          year: 2026,
          categoryId: "cat_1",
          heroImageUrl: "/hero.jpg",
          cardImageUrl: "/card.jpg",
          publishStatus: "published" as const,
          createdAt: "2026-03-26T00:00:00.000Z",
          updatedAt: "2026-03-26T00:00:00.000Z",
        },
      }),
      createDomainEvent({
        type: "lesson_created",
        aggregateType: "lesson",
        aggregateId: "lesson_1",
        payload: {
          lessonId: "lesson_1",
          courseId: "course_1",
          title: "Lesson 1",
          synopsis: "Lesson synopsis",
          durationMin: 10,
          maturityRating: "PG",
          manifestBlobKey: "courses/course_1/master.m3u8",
          streamAssetId: "asset_1",
          publishStatus: "published" as const,
          createdAt: "2026-03-26T00:00:00.000Z",
          updatedAt: "2026-03-26T00:00:00.000Z",
        },
      }),
      createDomainEvent({
        type: "course_deleted",
        aggregateType: "course",
        aggregateId: "course_1",
        payload: {
          courseId: "course_1",
        },
      }),
    ],
  );

  assert.equal(reduced.catalogCourses.course_1, undefined);
  assert.equal(reduced.catalogLessons.lesson_1, undefined);
  assert.equal(reduced.eventTypeCounts.course_created, 1);
  assert.equal(reduced.eventTypeCounts.lesson_created, 1);
  assert.equal(reduced.eventTypeCounts.course_deleted, 1);
});

test("applyProjectionEvents updates lesson manifest from attachment event", () => {
  const reduced = applyProjectionEvents(
    {
      ...createEmptyProjectionState(),
      catalogLessons: {
        lesson_1: {
          lessonId: "lesson_1",
          courseId: "course_1",
          title: "Lesson 1",
          synopsis: "Lesson synopsis",
          durationMin: 10,
          maturityRating: "PG",
          manifestBlobKey: "",
          streamAssetId: undefined,
          publishStatus: "draft",
          createdAt: "2026-03-26T00:00:00.000Z",
          updatedAt: "2026-03-26T00:00:00.000Z",
        },
      },
    },
    [
      createDomainEvent({
        type: "lesson_manifest_attached",
        aggregateType: "lesson",
        aggregateId: "lesson_1",
        payload: {
          lessonId: "lesson_1",
          courseId: "course_1",
          manifestBlobKey: "courses/course_1/lessons/lesson_1/master.m3u8",
          streamAssetId: "asset_1",
          updatedAt: "2026-03-26T01:00:00.000Z",
        },
      }),
    ],
  );

  assert.equal(
    reduced.catalogLessons.lesson_1?.manifestBlobKey,
    "courses/course_1/lessons/lesson_1/master.m3u8",
  );
  assert.equal(reduced.catalogLessons.lesson_1?.streamAssetId, "asset_1");
  assert.equal(reduced.eventTypeCounts.lesson_manifest_attached, 1);
});

test("applyProjectionEvents persists source attachment before manifest exists", () => {
  const reduced = applyProjectionEvents(
    {
      ...createEmptyProjectionState(),
      catalogLessons: {
        lesson_1: {
          lessonId: "lesson_1",
          courseId: "course_1",
          title: "Lesson 1",
          synopsis: "Lesson synopsis",
          durationMin: 10,
          maturityRating: "PG",
          manifestBlobKey: "",
          streamAssetId: undefined,
          publishStatus: "draft",
          createdAt: "2026-03-26T00:00:00.000Z",
          updatedAt: "2026-03-26T00:00:00.000Z",
        },
      },
    },
    [
      createDomainEvent({
        type: "lesson_asset_attached",
        aggregateType: "lesson",
        aggregateId: "lesson_1",
        payload: {
          lessonId: "lesson_1",
          courseId: "course_1",
          streamAssetId: "asset_source_1",
          updatedAt: "2026-03-26T00:30:00.000Z",
        },
      }),
    ],
  );

  assert.equal(reduced.catalogLessons.lesson_1?.streamAssetId, "asset_source_1");
  assert.equal(reduced.catalogLessons.lesson_1?.manifestBlobKey, "");
  assert.equal(reduced.eventTypeCounts.lesson_asset_attached, 1);
});

test("applyProjectionEvents marks lesson packaging as requested", () => {
  const reduced = applyProjectionEvents(
    {
      ...createEmptyProjectionState(),
      catalogLessons: {
        lesson_1: {
          lessonId: "lesson_1",
          courseId: "course_1",
          title: "Lesson 1",
          synopsis: "Lesson synopsis",
          durationMin: 10,
          maturityRating: "PG",
          manifestBlobKey: "",
          streamAssetId: "asset_source_1",
          processingStatus: "source_uploaded",
          publishStatus: "draft",
          createdAt: "2026-03-26T00:00:00.000Z",
          updatedAt: "2026-03-26T00:00:00.000Z",
        },
      },
    },
    [
      createDomainEvent({
        type: "lesson_processing_requested",
        aggregateType: "lesson",
        aggregateId: "lesson_1",
        payload: {
          lessonId: "lesson_1",
          courseId: "course_1",
          updatedAt: "2026-03-26T00:45:00.000Z",
        },
      }),
    ],
  );

  assert.equal(reduced.catalogLessons.lesson_1?.processingStatus, "packaging_requested");
  assert.equal(reduced.eventTypeCounts.lesson_processing_requested, 1);
});

test("event-native projections derive dashboard and creator analytics from activity events", () => {
  const reduced = applyProjectionEvents(
    createEmptyProjectionState(),
    [
      createDomainEvent({
        type: "course_created",
        aggregateType: "course",
        aggregateId: "course_1",
        payload: {
          courseId: "course_1",
          creatorProfileId: "creator_1",
          title: "Course 1",
          synopsis: "Course synopsis",
          year: 2026,
          categoryId: "cat_1",
          heroImageUrl: "/hero.jpg",
          cardImageUrl: "/card.jpg",
          publishStatus: "published" as const,
          createdAt: "2026-03-26T00:00:00.000Z",
          updatedAt: "2026-03-26T00:00:00.000Z",
        },
      }),
      createDomainEvent({
        type: "lesson_created",
        aggregateType: "lesson",
        aggregateId: "lesson_1",
        payload: {
          lessonId: "lesson_1",
          courseId: "course_1",
          title: "Lesson 1",
          synopsis: "Lesson synopsis",
          durationMin: 10,
          maturityRating: "PG",
          manifestBlobKey: "courses/course_1/master.m3u8",
          streamAssetId: "asset_1",
          publishStatus: "published" as const,
          createdAt: "2026-03-26T00:00:00.000Z",
          updatedAt: "2026-03-26T00:00:00.000Z",
        },
      }),
      createDomainEvent({
        type: "playback_session_created",
        aggregateType: "playback_session",
        aggregateId: "ps_1",
        payload: {
          playbackSessionId: "ps_1",
          lessonId: "lesson_1",
          courseId: "course_1",
          userId: "user_1",
          profileId: "profile_1",
          manifestBlobKey: "courses/course_1/master.m3u8",
          entitlementSource: "course_entitlement",
          expiresAt: "2026-03-26T01:00:00.000Z",
          createdAt: "2026-03-26T00:10:00.000Z",
        },
      }),
      createDomainEvent({
        type: "progress_checkpoint_recorded",
        aggregateType: "progress",
        aggregateId: "progress_1",
        payload: {
          progressId: "progress_1",
          userId: "user_1",
          profileId: "profile_1",
          lessonId: "lesson_1",
          courseId: "course_1",
          progressPercent: 50,
          lastPositionSec: 300,
          updatedAt: "2026-03-26T00:15:00.000Z",
        },
      }),
      createDomainEvent({
        type: "qoe_event_recorded",
        aggregateType: "qoe",
        aggregateId: "qoe_1",
        payload: {
          playbackSessionId: "ps_1",
          lessonId: "lesson_1",
          courseId: "course_1",
          userId: "user_1",
          profileId: "profile_1",
          type: "rebuffer_start" as const,
          eventTs: "2026-03-26T00:16:00.000Z",
          positionMs: 120000,
          rebufferMs: 1500,
          peerHitRatio: 80,
          deviceId: "device_1",
        },
      }),
    ],
  );

  const dashboards = buildStudentDashboardProjections({
    catalogCourses: reduced.catalogCourses,
    catalogLessons: reduced.catalogLessons,
    progressRecords: reduced.progressRecords,
  });
  const analytics = buildCreatorAnalyticsProjections({
    catalogCourses: reduced.catalogCourses,
    catalogLessons: reduced.catalogLessons,
    playbackSessions: reduced.playbackSessions,
    progressRecords: reduced.progressRecords,
    qoeEvents: reduced.qoeEvents,
  });

  assert.equal(dashboards.user_1?.activeCourseCount, 1);
  assert.equal(dashboards.user_1?.continueWatching[0]?.titleId, "lesson_1");
  assert.equal(dashboards.user_1?.continueWatching[0]?.progressPercent, 50);
  assert.equal(analytics.creator_1?.publishedCourseCount, 1);
  assert.equal(analytics.creator_1?.totalViews, 1);
  assert.equal(analytics.creator_1?.totalWatchTimeMin, 5);
  assert.equal(analytics.creator_1?.totalRebufferEvents, 1);
  assert.equal(analytics.creator_1?.lessons[0]?.averagePeerHitRatio, 80);
});
