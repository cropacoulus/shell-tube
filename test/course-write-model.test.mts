import test from "node:test";
import assert from "node:assert/strict";

import {
  buildVideoCompatibilityRecord,
  normalizeLegacyVideos,
} from "../lib/server/course-write-model.ts";

test("normalizeLegacyVideos splits a legacy video row into course and lesson records", () => {
  const normalized = normalizeLegacyVideos([
    {
      id: "vid_legacy",
      title: "Legacy Course",
      synopsis: "Legacy synopsis",
      year: 2026,
      maturityRating: "13+",
      durationMin: 90,
      categoryId: "cat_1",
      heroImageUrl: "hero.jpg",
      cardImageUrl: "card.jpg",
      manifestBlobKey: "blob/master.m3u8",
      streamAssetId: "asset_1",
      publishStatus: "draft",
      createdAt: "2026-03-16T00:00:00.000Z",
    },
  ]);

  assert.equal(normalized.courses.length, 1);
  assert.equal(normalized.lessons.length, 1);
  assert.equal(normalized.courses[0]?.id, "vid_legacy");
  assert.equal(normalized.lessons[0]?.courseId, "vid_legacy");
  assert.equal(normalized.lessons[0]?.id, "lesson-vid_legacy-main");
  assert.equal(normalized.lessons[0]?.publishStatus, "draft");
});

test("buildVideoCompatibilityRecord combines course and lesson into admin video shape", () => {
  const record = buildVideoCompatibilityRecord(
    {
      id: "course_1",
      title: "Course 1",
      synopsis: "Course synopsis",
      year: 2026,
      categoryId: "cat_1",
      heroImageUrl: "hero.jpg",
      cardImageUrl: "card.jpg",
      publishStatus: "published",
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
      publishStatus: "published",
      createdAt: "2026-03-16T00:00:00.000Z",
    },
  );

  assert.equal(record.id, "course_1");
  assert.equal(record.durationMin, 55);
  assert.equal(record.manifestBlobKey, "blob/master.m3u8");
  assert.equal(record.streamAssetId, "asset_1");
  assert.equal(record.publishStatus, "published");
});
