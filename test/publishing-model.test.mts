import test from "node:test";
import assert from "node:assert/strict";

import {
  inferAssetType,
  isPublishedVideo,
  normalizeVideoRecord,
} from "../lib/server/publishing-model.ts";

test("normalizeVideoRecord marks legacy video rows as published", () => {
  const normalized = normalizeVideoRecord({
    id: "vid_legacy",
    title: "Legacy",
    synopsis: "Old row",
    year: 2026,
    maturityRating: "13+",
    durationMin: 90,
    categoryId: "cat_1",
    heroImageUrl: "",
    cardImageUrl: "",
    manifestBlobKey: "blob/master.m3u8",
    createdAt: "2026-03-16T00:00:00.000Z",
  });

  assert.equal(normalized.publishStatus, "published");
  assert.equal(isPublishedVideo(normalized), true);
});

test("inferAssetType recognizes HLS manifest uploads", () => {
  assert.equal(
    inferAssetType({
      fileName: "master.m3u8",
      folder: "manifests",
      contentType: "application/vnd.apple.mpegurl",
    }),
    "manifest",
  );

  assert.equal(
    inferAssetType({
      fileName: "lesson.mp4",
      folder: "videos",
      contentType: "video/mp4",
    }),
    "source_video",
  );
});
