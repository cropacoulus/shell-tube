import assert from "node:assert/strict";
import test from "node:test";

import { validateCreatorPublishState } from "../lib/creator/content-validation.ts";

test("draft creator content can be saved without a manifest", () => {
  assert.equal(
    validateCreatorPublishState({
      publishStatus: "draft",
      manifestBlobKey: "",
    }),
    null,
  );
});

test("published creator content requires a manifest", () => {
  assert.equal(
    validateCreatorPublishState({
      publishStatus: "published",
      manifestBlobKey: "",
    }),
    "Published lessons require a manifest blob key.",
  );
});
