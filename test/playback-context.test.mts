import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPlaybackContext,
  toEntitlementRequest,
} from "../lib/server/playback-context.ts";

test("buildPlaybackContext maps lesson record to lesson-centric playback context", () => {
  const context = buildPlaybackContext({
    id: "lesson-course_1-main",
    courseId: "course_1",
    manifestBlobKey: "blob/master.m3u8",
  });

  assert.equal(context.lessonId, "lesson-course_1-main");
  assert.equal(context.courseId, "course_1");
  assert.equal(context.manifestBlobKey, "blob/master.m3u8");
});

test("toEntitlementRequest evaluates access via course while preserving lesson context", () => {
  const request = toEntitlementRequest(
    {
      lessonId: "lesson-course_1-main",
      courseId: "course_1",
      manifestBlobKey: "blob/master.m3u8",
    },
    {
      userId: "user_1",
      profileId: "profile_1",
      region: "ID",
    },
  );

  assert.equal(request.titleId, "course_1");
  assert.equal(request.lessonId, "lesson-course_1-main");
  assert.equal(request.userId, "user_1");
});
