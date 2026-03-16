import test from "node:test";
import assert from "node:assert/strict";

import { buildCreatorRevenueSnapshot } from "../lib/server/creator-revenue-flow.ts";

test("buildCreatorRevenueSnapshot derives placeholder course revenue and subscription share", async () => {
  const snapshot = await buildCreatorRevenueSnapshot({
    activityRepository: {
      listAllLessonProgress: async () => [
        {
          id: "prog_1",
          userId: "user_1",
          profileId: "profile_1",
          lessonId: "lesson_1",
          courseId: "course_1",
          progressPercent: 100,
          lastPositionSec: 600,
          completedAt: "2026-03-16T00:10:00.000Z",
          updatedAt: "2026-03-16T00:10:00.000Z",
        },
        {
          id: "prog_2",
          userId: "user_2",
          profileId: "profile_2",
          lessonId: "lesson_2",
          courseId: "course_2",
          progressPercent: 50,
          lastPositionSec: 600,
          updatedAt: "2026-03-16T00:11:00.000Z",
        },
      ],
    },
    contentRepository: {
      listCourseRecords: async () => [
        {
          id: "course_1",
          creatorProfileId: "creator_1",
          title: "Course 1",
          synopsis: "Synopsis",
          year: 2026,
          categoryId: "cat_1",
          heroImageUrl: "",
          cardImageUrl: "",
          publishStatus: "published",
          createdAt: "2026-03-16T00:00:00.000Z",
        },
        {
          id: "course_2",
          creatorProfileId: "creator_2",
          title: "Course 2",
          synopsis: "Synopsis",
          year: 2026,
          categoryId: "cat_1",
          heroImageUrl: "",
          cardImageUrl: "",
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
          durationMin: 10,
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
          durationMin: 10,
          maturityRating: "13+",
          manifestBlobKey: "blob/master.m3u8",
          publishStatus: "published",
          createdAt: "2026-03-16T00:00:00.000Z",
        },
      ],
    },
  }, {
    creatorProfileId: "creator_1",
    now: new Date("2026-03-16T00:00:00.000Z"),
  });

  assert.equal(snapshot.projectedSubscriptionShareUsd, 500);
  assert.equal(snapshot.projectedCourseRevenueUsd, 34.3);
  assert.equal(snapshot.totalProjectedRevenueUsd, 534.3);
  assert.equal(snapshot.payoutLedger.length, 2);
  assert.match(snapshot.payoutLedger[0]?.formulaSnapshot ?? "", /placeholder_/);
});

test("buildCreatorRevenueSnapshot narrows ledger to a single course when requested", async () => {
  const snapshot = await buildCreatorRevenueSnapshot({
    activityRepository: {
      listAllLessonProgress: async () => [
        {
          id: "prog_1",
          userId: "user_1",
          profileId: "profile_1",
          lessonId: "lesson_1",
          courseId: "course_1",
          progressPercent: 100,
          lastPositionSec: 300,
          completedAt: "2026-03-16T00:10:00.000Z",
          updatedAt: "2026-03-16T00:10:00.000Z",
        },
        {
          id: "prog_2",
          userId: "user_2",
          profileId: "profile_2",
          lessonId: "lesson_2",
          courseId: "course_2",
          progressPercent: 100,
          lastPositionSec: 900,
          completedAt: "2026-03-16T00:20:00.000Z",
          updatedAt: "2026-03-16T00:20:00.000Z",
        },
      ],
    },
    contentRepository: {
      listCourseRecords: async () => [
        {
          id: "course_1",
          creatorProfileId: "creator_1",
          title: "Course 1",
          synopsis: "Synopsis",
          year: 2026,
          categoryId: "cat_1",
          heroImageUrl: "",
          cardImageUrl: "",
          publishStatus: "published",
          createdAt: "2026-03-16T00:00:00.000Z",
        },
        {
          id: "course_2",
          creatorProfileId: "creator_1",
          title: "Course 2",
          synopsis: "Synopsis",
          year: 2026,
          categoryId: "cat_1",
          heroImageUrl: "",
          cardImageUrl: "",
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
          durationMin: 10,
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
          durationMin: 10,
          maturityRating: "13+",
          manifestBlobKey: "blob/master.m3u8",
          publishStatus: "published",
          createdAt: "2026-03-16T00:00:00.000Z",
        },
      ],
    },
  }, {
    creatorProfileId: "creator_1",
    courseId: "course_2",
    now: new Date("2026-03-16T00:00:00.000Z"),
  });

  assert.equal(snapshot.payoutLedger.every((entry) => entry.courseId === "course_2"), true);
  assert.equal(snapshot.projectedSubscriptionShareUsd, 750);
});
