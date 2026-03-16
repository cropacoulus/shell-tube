import test from "node:test";
import assert from "node:assert/strict";

import {
  mapCourseEnrollmentRow,
  mapLessonProgressRow,
  mapPlaybackSessionRow,
  mapQoeEventRow,
} from "../lib/repositories/mysql/mysql-activity-mappers.ts";

test("mapLessonProgressRow converts mysql progress row into a domain record", () => {
  const record = mapLessonProgressRow({
    id: "prog_1",
    user_id: "user_1",
    profile_id: "profile_1",
    lesson_id: "lesson_1",
    course_id: "course_1",
    progress_percent: 62,
    last_position_sec: 420,
    completed_at: null,
    updated_at: "2026-03-16T00:00:00.000Z",
  });

  assert.equal(record.lessonId, "lesson_1");
  assert.equal(record.progressPercent, 62);
  assert.equal(record.lastPositionSec, 420);
});

test("mapCourseEnrollmentRow converts mysql enrollment row into a domain record", () => {
  const record = mapCourseEnrollmentRow({
    id: "enr_1",
    user_id: "user_1",
    profile_id: "profile_1",
    course_id: "course_1",
    source: "manual",
    active: 1,
    created_at: "2026-03-16T00:00:00.000Z",
    updated_at: "2026-03-16T00:00:00.000Z",
  });

  assert.equal(record.courseId, "course_1");
  assert.equal(record.active, true);
  assert.equal(record.source, "manual");
});

test("mapPlaybackSessionRow converts mysql playback session row into a domain record", () => {
  const record = mapPlaybackSessionRow({
    id: "ps_1",
    user_id: "user_1",
    profile_id: "profile_1",
    course_id: "course_1",
    lesson_id: "lesson_1",
    manifest_blob_key: "blob/master.m3u8",
    entitlement_source: "premium",
    playback_token: "token_1",
    expires_at: "2026-03-16T00:10:00.000Z",
    created_at: "2026-03-16T00:00:00.000Z",
  });

  assert.equal(record.id, "ps_1");
  assert.equal(record.lessonId, "lesson_1");
  assert.equal(record.entitlementSource, "premium");
});

test("mapQoeEventRow converts mysql qoe row into a domain record", () => {
  const record = mapQoeEventRow({
    id: "qoe_1",
    playback_session_id: "ps_1",
    user_id: "user_1",
    profile_id: "profile_1",
    course_id: "course_1",
    lesson_id: "lesson_1",
    event_type: "rebuffer_start",
    event_ts: "2026-03-16T00:03:00.000Z",
    position_ms: 3000,
    bitrate_kbps: 1800,
    rebuffer_ms: 1200,
    peer_hit_ratio: 75,
    error_code: null,
    device_id: "web-player",
    created_at: "2026-03-16T00:03:01.000Z",
  });

  assert.equal(record.playbackSessionId, "ps_1");
  assert.equal(record.lessonId, "lesson_1");
  assert.equal(record.rebufferMs, 1200);
  assert.equal(record.peerHitRatio, 75);
});
