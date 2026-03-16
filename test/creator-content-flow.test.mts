import test from "node:test";
import assert from "node:assert/strict";

import { canAccessCreatorCourseWithRepository } from "../lib/server/creator-content-flow.ts";

test("canAccessCreatorCourse allows creator to access owned course", async () => {
  const allowed = await canAccessCreatorCourseWithRepository(
    {
      getCourseRecordById: async (id: string) => ({
        id,
        creatorProfileId: "profile_1",
        title: "Course 1",
        synopsis: "Synopsis",
        year: 2026,
        categoryId: "cat_1",
        heroImageUrl: "hero.jpg",
        cardImageUrl: "card.jpg",
        publishStatus: "published",
        createdAt: "2026-03-16T00:00:00.000Z",
      }),
    },
    {
      courseId: "course_1",
      profileId: "profile_1",
      role: "creator",
    },
  );

  assert.equal(allowed, true);
});

test("canAccessCreatorCourse blocks creator from accessing another creator's course", async () => {
  const allowed = await canAccessCreatorCourseWithRepository(
    {
      getCourseRecordById: async (id: string) => ({
        id,
        creatorProfileId: "profile_2",
        title: "Course 2",
        synopsis: "Synopsis",
        year: 2026,
        categoryId: "cat_1",
        heroImageUrl: "hero.jpg",
        cardImageUrl: "card.jpg",
        publishStatus: "published",
        createdAt: "2026-03-16T00:00:00.000Z",
      }),
    },
    {
      courseId: "course_2",
      profileId: "profile_1",
      role: "creator",
    },
  );

  assert.equal(allowed, false);
});
