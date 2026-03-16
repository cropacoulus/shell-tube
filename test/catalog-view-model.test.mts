import test from "node:test";
import assert from "node:assert/strict";

import { buildLocalTitleSummary } from "../lib/server/catalog-view-model.ts";

test("buildLocalTitleSummary can represent a course and its main lesson", () => {
  const summary = buildLocalTitleSummary(
    {
      id: "course_1",
      title: "Course 1",
      synopsis: "Course synopsis",
      year: 2026,
      heroImageUrl: "hero.jpg",
      cardImageUrl: "card.jpg",
    },
    {
      id: "lesson-course_1-main",
      courseId: "course_1",
      durationMin: 55,
      maturityRating: "13+",
    },
  );

  assert.equal(summary.id, "course_1");
  assert.equal(summary.title, "Course 1");
  assert.equal(summary.durationMin, 55);
  assert.equal(summary.maturityRating, "13+");
});
