import test from "node:test";
import assert from "node:assert/strict";

import { resolveEffectiveUserRole } from "../lib/auth/effective-role.ts";

test("effective role upgrades student session to creator when stored profile is approved", () => {
  const role = resolveEffectiveUserRole({
    fallbackRole: "student",
    storedRole: "creator",
  });
  assert.equal(role, "creator");
});

test("effective role preserves admin fallback without profile lookup dependency", () => {
  const role = resolveEffectiveUserRole({
    fallbackRole: "admin",
    storedRole: "student",
  });
  assert.equal(role, "admin");
});
