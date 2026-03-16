import test from "node:test";
import assert from "node:assert/strict";

import { buildProgressPayload } from "../lib/player/progress-payload.ts";

test("buildProgressPayload converts current time and duration into lesson progress", () => {
  const payload = buildProgressPayload({
    lessonId: "lesson_1",
    currentSec: 120.4,
    durationSec: 300,
  });

  assert.deepEqual(payload, {
    lessonId: "lesson_1",
    progressPercent: 40,
    lastPositionSec: 120,
  });
});

test("buildProgressPayload clamps missing or invalid duration to zero progress", () => {
  const payload = buildProgressPayload({
    lessonId: "lesson_1",
    currentSec: 120,
    durationSec: 0,
  });

  assert.equal(payload.progressPercent, 0);
  assert.equal(payload.lastPositionSec, 120);
});
