import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAdminContentItem,
  splitAdminContentInput,
} from "../lib/server/admin-content-model.ts";

test("buildAdminContentItem combines course and lesson into one editor record", () => {
  const item = buildAdminContentItem(
    {
      id: "course_1",
      title: "Course 1",
      synopsis: "Course synopsis",
      year: 2026,
      categoryId: "cat_1",
      heroImageUrl: "hero.jpg",
      cardImageUrl: "card.jpg",
      publishStatus: "draft",
      createdAt: "2026-03-16T00:00:00.000Z",
    },
    {
      id: "lesson-course_1-main",
      courseId: "course_1",
      title: "Course 1 • Main Lesson",
      synopsis: "Lesson synopsis",
      durationMin: 55,
      maturityRating: "13+",
      manifestBlobKey: "blob/master.m3u8",
      streamAssetId: "asset_1",
      publishStatus: "draft",
      createdAt: "2026-03-16T00:00:00.000Z",
    },
  );

  assert.equal(item.id, "course_1");
  assert.equal(item.courseId, "course_1");
  assert.equal(item.lessonId, "lesson-course_1-main");
  assert.equal(item.title, "Course 1");
  assert.equal(item.durationMin, 55);
});

test("splitAdminContentInput separates course and lesson payloads", () => {
  const split = splitAdminContentInput({
    title: "Course 1",
    synopsis: "Course synopsis",
    year: 2026,
    categoryId: "cat_1",
    heroImageUrl: "hero.jpg",
    cardImageUrl: "card.jpg",
    durationMin: 55,
    maturityRating: "13+",
    manifestBlobKey: "blob/master.m3u8",
    streamAssetId: "asset_1",
    publishStatus: "published",
  });

  assert.equal(split.course.title, "Course 1");
  assert.equal(split.course.publishStatus, "published");
  assert.equal(split.lesson.durationMin, 55);
  assert.equal(split.lesson.manifestBlobKey, "blob/master.m3u8");
});
