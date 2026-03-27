import assert from "node:assert/strict";
import test from "node:test";

import { resetMemoryProjectionStore, memoryProjectionStore } from "../lib/projection-store/memory-projection-store.ts";
import { listLessonProgressByUserFromStore } from "../lib/projections/progress-read-model.ts";

test("listLessonProgressByUserFromProjection returns user records sorted by updatedAt desc", async () => {
  resetMemoryProjectionStore();
  await memoryProjectionStore.setJson("stream:projection:activity:progress", {
    progress_1: {
      id: "progress_1",
      userId: "user_1",
      profileId: "profile_1",
      lessonId: "lesson_1",
      courseId: "course_1",
      progressPercent: 40,
      lastPositionSec: 120,
      updatedAt: "2026-03-26T00:10:00.000Z",
    },
    progress_2: {
      id: "progress_2",
      userId: "user_2",
      profileId: "profile_2",
      lessonId: "lesson_2",
      courseId: "course_2",
      progressPercent: 10,
      lastPositionSec: 30,
      updatedAt: "2026-03-26T00:12:00.000Z",
    },
    progress_3: {
      id: "progress_3",
      userId: "user_1",
      profileId: "profile_1",
      lessonId: "lesson_3",
      courseId: "course_3",
      progressPercent: 90,
      lastPositionSec: 540,
      completedAt: "2026-03-26T00:20:00.000Z",
      updatedAt: "2026-03-26T00:20:00.000Z",
    },
  });

  const items = await listLessonProgressByUserFromStore(memoryProjectionStore, "user_1");

  assert.equal(items.length, 2);
  assert.equal(items[0]?.id, "progress_3");
  assert.equal(items[1]?.id, "progress_1");
});
