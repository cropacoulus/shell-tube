import test from "node:test";
import assert from "node:assert/strict";

import { buildDashboardSnapshot } from "../lib/server/dashboard-flow.ts";

test("getDashboardSnapshot joins published course and lesson progress into continue watching", async () => {
  const snapshot = await buildDashboardSnapshot("user_1", {
    activityRepository: {
      listLessonProgressByUser: async (userId: string) => {
        void userId;
        return [
          {
            id: "prog_1",
            userId: "user_1",
            profileId: "profile_1",
            lessonId: "lesson_1",
            courseId: "course_1",
            progressPercent: 40,
            lastPositionSec: 120,
            updatedAt: "2026-03-16T00:00:00.000Z",
          },
          {
            id: "prog_2",
            userId: "user_1",
            profileId: "profile_1",
            lessonId: "lesson_2",
            courseId: "course_2",
            progressPercent: 100,
            lastPositionSec: 600,
            completedAt: "2026-03-16T00:10:00.000Z",
            updatedAt: "2026-03-16T00:10:00.000Z",
          },
        ];
      },
      listCourseEnrollmentsByUser: async (userId: string) => {
        void userId;
        return [
          {
            id: "enr_1",
            userId: "user_1",
            profileId: "profile_1",
            courseId: "course_1",
            source: "manual",
            active: true,
            createdAt: "2026-03-16T00:00:00.000Z",
            updatedAt: "2026-03-16T00:00:00.000Z",
          },
        ];
      },
    },
    contentRepository: {
      getLessonRecordById: async (lessonId: string) => {
        if (lessonId === "lesson_1") {
          return {
            id: "lesson_1",
            courseId: "course_1",
            title: "Lesson 1",
            synopsis: "S1",
            durationMin: 50,
            maturityRating: "13+",
            manifestBlobKey: "blob_1",
            publishStatus: "published",
            createdAt: "2026-03-16T00:00:00.000Z",
          };
        }
        if (lessonId === "lesson_2") {
          return {
            id: "lesson_2",
            courseId: "course_2",
            title: "Lesson 2",
            synopsis: "S2",
            durationMin: 10,
            maturityRating: "13+",
            manifestBlobKey: "blob_2",
            publishStatus: "draft",
            createdAt: "2026-03-16T00:00:00.000Z",
          };
        }
        return null;
      },
      getCourseRecordById: async (courseId: string) => {
        if (courseId === "course_1") {
          return {
            id: "course_1",
            title: "Course 1",
            synopsis: "Synopsis",
            year: 2026,
            categoryId: "cat_1",
            heroImageUrl: "hero.jpg",
            cardImageUrl: "card.jpg",
            publishStatus: "published",
            createdAt: "2026-03-16T00:00:00.000Z",
          };
        }
        return {
          id: "course_2",
          title: "Course 2",
          synopsis: "Synopsis",
          year: 2026,
          categoryId: "cat_1",
          heroImageUrl: "hero2.jpg",
          cardImageUrl: "card2.jpg",
          publishStatus: "published",
          createdAt: "2026-03-16T00:00:00.000Z",
        };
      },
    },
  });

  assert.equal(snapshot.activeCourseCount, 1);
  assert.equal(snapshot.completedLessonCount, 1);
  assert.equal(snapshot.continueWatching.length, 1);
  assert.equal(snapshot.continueWatching[0]?.titleId, "lesson_1");
  assert.equal(snapshot.continueWatching[0]?.remainingMin, 30);
});
