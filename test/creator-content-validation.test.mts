import assert from "node:assert/strict";
import test from "node:test";

import {
  getCreatorContentFieldErrors,
  validateCreatorContentCore,
  validateCreatorPublishState,
} from "../lib/creator/content-validation.ts";

test("validateCreatorContentCore rejects empty draft payload", () => {
  const result = validateCreatorContentCore({
    title: "",
    synopsis: "",
    categoryId: "",
    durationMin: 0,
  });

  assert.equal(result, "Course title is required.");
});

test("validateCreatorPublishState still requires manifest for published lesson", () => {
  const result = validateCreatorPublishState({
    publishStatus: "published",
    manifestBlobKey: "",
  });

  assert.equal(result, "Published lessons require a manifest blob key.");
});

test("getCreatorContentFieldErrors reports field-level validation", () => {
  const result = getCreatorContentFieldErrors({
    title: "",
    synopsis: "",
    categoryId: "",
    durationMin: 0,
  });

  assert.equal(result.title, "Course title is required.");
  assert.equal(result.synopsis, "Course synopsis is required.");
  assert.equal(result.categoryId, "Category is required.");
  assert.equal(result.durationMin, "Lesson duration must be greater than zero.");
});
