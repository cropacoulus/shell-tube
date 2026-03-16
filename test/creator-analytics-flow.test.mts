import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCreatorAnalyticsSnapshot,
} from "../lib/server/creator-analytics-flow.ts";

test("buildCreatorAnalyticsSnapshot derives views, watch time, and completion rate from activity data", async () => {
  const snapshot = await buildCreatorAnalyticsSnapshot({
    activityRepository: {
      listAllLessonProgress: async () => [
        {
          id: "prog_1",
          userId: "user_1",
          profileId: "profile_1",
          lessonId: "lesson_1",
          courseId: "course_1",
          progressPercent: 50,
          lastPositionSec: 600,
          updatedAt: "2026-03-16T00:00:00.000Z",
        },
        {
          id: "prog_2",
          userId: "user_2",
          profileId: "profile_2",
          lessonId: "lesson_1",
          courseId: "course_1",
          progressPercent: 100,
          lastPositionSec: 1200,
          completedAt: "2026-03-16T00:10:00.000Z",
          updatedAt: "2026-03-16T00:10:00.000Z",
        },
      ],
      listAllPlaybackSessionRecords: async () => [
        {
          id: "ps_1",
          userId: "user_1",
          profileId: "profile_1",
          courseId: "course_1",
          lessonId: "lesson_1",
          manifestBlobKey: "blob/master.m3u8",
          entitlementSource: "premium",
          playbackToken: "token_1",
          expiresAt: "2026-03-16T00:10:00.000Z",
          createdAt: "2026-03-16T00:00:00.000Z",
        },
        {
          id: "ps_2",
          userId: "user_2",
          profileId: "profile_2",
          courseId: "course_1",
          lessonId: "lesson_1",
          manifestBlobKey: "blob/master.m3u8",
          entitlementSource: "premium",
          playbackToken: "token_2",
          expiresAt: "2026-03-16T00:20:00.000Z",
          createdAt: "2026-03-16T00:10:00.000Z",
        },
      ],
      listAllQoeEventRecords: async () => [
        {
          id: "qoe_1",
          playbackSessionId: "ps_1",
          userId: "user_1",
          profileId: "profile_1",
          courseId: "course_1",
          lessonId: "lesson_1",
          type: "rebuffer_start",
          eventTs: "2026-03-16T00:01:00.000Z",
          positionMs: 3000,
          peerHitRatio: 70,
          deviceId: "web-player",
          createdAt: "2026-03-16T00:01:01.000Z",
        },
        {
          id: "qoe_2",
          playbackSessionId: "ps_2",
          userId: "user_2",
          profileId: "profile_2",
          courseId: "course_1",
          lessonId: "lesson_1",
          type: "fatal_error",
          eventTs: "2026-03-16T00:02:00.000Z",
          positionMs: 4000,
          peerHitRatio: 90,
          errorCode: "MEDIA_ERR",
          deviceId: "web-player",
          createdAt: "2026-03-16T00:02:01.000Z",
        },
      ],
    },
    contentRepository: {
      listCourseRecords: async () => [
        {
          id: "course_1",
          creatorProfileId: "profile_1",
          title: "Course 1",
          synopsis: "Synopsis",
          year: 2026,
          categoryId: "cat_1",
          heroImageUrl: "hero.jpg",
          cardImageUrl: "card.jpg",
          publishStatus: "published",
          createdAt: "2026-03-16T00:00:00.000Z",
        },
      ],
      listLessonRecords: async () => [
        {
          id: "lesson_1",
          courseId: "course_1",
          title: "Lesson 1",
          synopsis: "Synopsis",
          durationMin: 20,
          maturityRating: "13+",
          manifestBlobKey: "blob/master.m3u8",
          publishStatus: "published",
          createdAt: "2026-03-16T00:00:00.000Z",
        },
      ],
    },
  });

  assert.equal(snapshot.publishedCourseCount, 1);
  assert.equal(snapshot.publishedLessonCount, 1);
  assert.equal(snapshot.totalViews, 2);
  assert.equal(snapshot.totalWatchTimeMin, 30);
  assert.equal(snapshot.averageCompletionRate, 50);
  assert.equal(snapshot.totalRebufferEvents, 1);
  assert.equal(snapshot.totalFatalErrors, 1);
  assert.equal(snapshot.averagePeerHitRatio, 80);
  assert.equal(snapshot.lessons[0]?.views, 2);
  assert.equal(snapshot.lessons[0]?.watchTimeMin, 30);
  assert.equal(snapshot.lessons[0]?.completionRate, 50);
  assert.equal(snapshot.lessons[0]?.rebufferEvents, 1);
  assert.equal(snapshot.lessons[0]?.fatalErrors, 1);
  assert.equal(snapshot.lessons[0]?.averagePeerHitRatio, 80);
});

test("buildCreatorAnalyticsSnapshot filters to creator-owned courses", async () => {
  const snapshot = await buildCreatorAnalyticsSnapshot({
    activityRepository: {
      listAllLessonProgress: async () => [],
      listAllPlaybackSessionRecords: async () => [],
      listAllQoeEventRecords: async () => [],
    },
    contentRepository: {
      listCourseRecords: async () => [
        {
          id: "course_1",
          creatorProfileId: "profile_1",
          title: "Course 1",
          synopsis: "Synopsis",
          year: 2026,
          categoryId: "cat_1",
          heroImageUrl: "hero.jpg",
          cardImageUrl: "card.jpg",
          publishStatus: "published",
          createdAt: "2026-03-16T00:00:00.000Z",
        },
        {
          id: "course_2",
          creatorProfileId: "profile_2",
          title: "Course 2",
          synopsis: "Synopsis",
          year: 2026,
          categoryId: "cat_1",
          heroImageUrl: "hero2.jpg",
          cardImageUrl: "card2.jpg",
          publishStatus: "published",
          createdAt: "2026-03-16T00:00:00.000Z",
        },
      ],
      listLessonRecords: async () => [
        {
          id: "lesson_1",
          courseId: "course_1",
          title: "Lesson 1",
          synopsis: "Synopsis",
          durationMin: 20,
          maturityRating: "13+",
          manifestBlobKey: "blob/master.m3u8",
          publishStatus: "published",
          createdAt: "2026-03-16T00:00:00.000Z",
        },
        {
          id: "lesson_2",
          courseId: "course_2",
          title: "Lesson 2",
          synopsis: "Synopsis",
          durationMin: 30,
          maturityRating: "13+",
          manifestBlobKey: "blob/master-2.m3u8",
          publishStatus: "published",
          createdAt: "2026-03-16T00:00:00.000Z",
        },
      ],
    },
  }, {
    creatorProfileId: "profile_1",
  });

  assert.equal(snapshot.publishedCourseCount, 1);
  assert.equal(snapshot.publishedLessonCount, 1);
  assert.equal(snapshot.lessons.length, 1);
  assert.equal(snapshot.lessons[0]?.courseId, "course_1");
});

test("buildCreatorAnalyticsSnapshot can be narrowed to a single course in creator detail flow", async () => {
  const snapshot = await buildCreatorAnalyticsSnapshot({
    activityRepository: {
      listAllLessonProgress: async () => [],
      listAllPlaybackSessionRecords: async () => [],
      listAllQoeEventRecords: async () => [],
    },
    contentRepository: {
      listCourseRecords: async () => [
        {
          id: "course_1",
          creatorProfileId: "profile_1",
          title: "Course 1",
          synopsis: "Synopsis",
          year: 2026,
          categoryId: "cat_1",
          heroImageUrl: "hero.jpg",
          cardImageUrl: "card.jpg",
          publishStatus: "published",
          createdAt: "2026-03-16T00:00:00.000Z",
        },
        {
          id: "course_2",
          creatorProfileId: "profile_1",
          title: "Course 2",
          synopsis: "Synopsis",
          year: 2026,
          categoryId: "cat_1",
          heroImageUrl: "hero2.jpg",
          cardImageUrl: "card2.jpg",
          publishStatus: "published",
          createdAt: "2026-03-16T00:00:00.000Z",
        },
      ],
      listLessonRecords: async () => [
        {
          id: "lesson_1",
          courseId: "course_1",
          title: "Lesson 1",
          synopsis: "Synopsis",
          durationMin: 20,
          maturityRating: "13+",
          manifestBlobKey: "blob/master.m3u8",
          publishStatus: "published",
          createdAt: "2026-03-16T00:00:00.000Z",
        },
        {
          id: "lesson_2",
          courseId: "course_2",
          title: "Lesson 2",
          synopsis: "Synopsis",
          durationMin: 30,
          maturityRating: "13+",
          manifestBlobKey: "blob/master-2.m3u8",
          publishStatus: "published",
          createdAt: "2026-03-16T00:00:00.000Z",
        },
      ],
    },
  }, {
    creatorProfileId: "profile_1",
  });

  const courseLessons = snapshot.lessons.filter((lesson) => lesson.courseId === "course_1");
  assert.equal(courseLessons.length, 1);
  assert.equal(courseLessons[0]?.lessonId, "lesson_1");
});
