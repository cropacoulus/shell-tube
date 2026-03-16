import test from "node:test";
import assert from "node:assert/strict";

import { canBootstrapPlaybackSession } from "../lib/server/playback-session-guard.ts";

const auth = {
  userId: "user_1",
  profileId: "profile_1",
  region: "ID",
  sessionId: "session_1",
  role: "student" as const,
};

test("canBootstrapPlaybackSession accepts matching lesson session", () => {
  const result = canBootstrapPlaybackSession({
    session: {
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
    auth,
    titleId: "lesson_1",
  });

  assert.deepEqual(result, { ok: true });
});

test("canBootstrapPlaybackSession rejects session owned by another user", () => {
  const result = canBootstrapPlaybackSession({
    session: {
      id: "ps_1",
      userId: "user_2",
      profileId: "profile_2",
      courseId: "course_1",
      lessonId: "lesson_1",
      manifestBlobKey: "blob/master.m3u8",
      entitlementSource: "premium",
      playbackToken: "token_1",
      expiresAt: "2026-03-16T00:10:00.000Z",
      createdAt: "2026-03-16T00:00:00.000Z",
    },
    auth,
    titleId: "lesson_1",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 403);
  }
});
