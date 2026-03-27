import assert from "node:assert/strict";
import test from "node:test";

import { validateCreatorContentCore, validateCreatorPublishState } from "../lib/creator/content-validation.ts";

test("validateCreatorContentCore rejects empty draft payload", () => {
  const result = validateCreatorContentCore({
    title: "",
    synopsis: "",
    year: 2026,
    categoryId: "",
    durationMin: 0,
    maturityRating: "",
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
