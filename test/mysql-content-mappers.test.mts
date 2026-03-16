import test from "node:test";
import assert from "node:assert/strict";

import {
  buildVideoFromMysqlRows,
  mapCourseRow,
  mapLessonRow,
  mapMediaAssetRow,
} from "../lib/repositories/mysql/mysql-content-mappers.ts";

test("mapCourseRow converts a mysql course row into a domain record", () => {
  const course = mapCourseRow({
    id: "course_1",
    creator_profile_id: "profile_1",
    title: "Course 1",
    synopsis: "Synopsis",
    year: 2026,
    category_id: "cat_1",
    hero_image_url: "hero.jpg",
    card_image_url: "card.jpg",
    publish_status: "published",
    created_at: "2026-03-16T00:00:00.000Z",
  });

  assert.equal(course.id, "course_1");
  assert.equal(course.creatorProfileId, "profile_1");
  assert.equal(course.categoryId, "cat_1");
  assert.equal(course.publishStatus, "published");
});

test("buildVideoFromMysqlRows reconstructs compatibility video shape", () => {
  const video = buildVideoFromMysqlRows(
    {
      id: "course_1",
      creator_profile_id: "profile_1",
      title: "Course 1",
      synopsis: "Synopsis",
      year: 2026,
      category_id: "cat_1",
      hero_image_url: "hero.jpg",
      card_image_url: "card.jpg",
      publish_status: "published",
      created_at: "2026-03-16T00:00:00.000Z",
    },
    {
      id: "lesson_1",
      course_id: "course_1",
      title: "Course 1 • Main Lesson",
      synopsis: "Lesson synopsis",
      duration_min: 55,
      maturity_rating: "13+",
      manifest_blob_key: "blob/master.m3u8",
      stream_asset_id: "asset_1",
      publish_status: "published",
      created_at: "2026-03-16T00:00:00.000Z",
    },
  );

  assert.equal(video.id, "course_1");
  assert.equal(video.durationMin, 55);
  assert.equal(video.manifestBlobKey, "blob/master.m3u8");
  assert.equal(video.streamAssetId, "asset_1");
});

test("mapLessonRow converts a mysql lesson row into a domain record", () => {
  const lesson = mapLessonRow({
    id: "lesson_1",
    course_id: "course_1",
    title: "Course 1 • Main Lesson",
    synopsis: "Lesson synopsis",
    duration_min: 55,
    maturity_rating: "13+",
    manifest_blob_key: "blob/master.m3u8",
    stream_asset_id: "asset_1",
    publish_status: "published",
    created_at: "2026-03-16T00:00:00.000Z",
  });

  assert.equal(lesson.courseId, "course_1");
  assert.equal(lesson.durationMin, 55);
  assert.equal(lesson.streamAssetId, "asset_1");
});

test("mapMediaAssetRow converts mysql media asset row into domain record", () => {
  const asset = mapMediaAssetRow({
    id: "asset_1",
    title_id: "course_1",
    blob_key: "blob/master.m3u8",
    file_name: "master.m3u8",
    content_type: "application/vnd.apple.mpegurl",
    asset_type: "manifest",
    ingest_status: "ready",
    created_by_user_id: "user_1",
    created_at: "2026-03-16T00:00:00.000Z",
  });

  assert.equal(asset.id, "asset_1");
  assert.equal(asset.assetType, "manifest");
  assert.equal(asset.createdByUserId, "user_1");
});
