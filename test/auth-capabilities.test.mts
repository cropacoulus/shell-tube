import test from "node:test";
import assert from "node:assert/strict";

import {
  canModeratePlatform,
  canPublishContent,
  canViewCreatorAnalytics,
  normalizeUserRole,
} from "../lib/auth/capabilities.ts";

test("normalizeUserRole maps legacy user role to student", () => {
  assert.equal(normalizeUserRole("user"), "student");
  assert.equal(normalizeUserRole("student"), "student");
  assert.equal(normalizeUserRole("creator"), "creator");
  assert.equal(normalizeUserRole("admin"), "admin");
});

test("creator capabilities allow publish and analytics without admin moderation", () => {
  assert.equal(canPublishContent("creator"), true);
  assert.equal(canViewCreatorAnalytics("creator"), true);
  assert.equal(canModeratePlatform("creator"), false);
});

test("admin capabilities include creator and moderation access", () => {
  assert.equal(canPublishContent("admin"), true);
  assert.equal(canViewCreatorAnalytics("admin"), true);
  assert.equal(canModeratePlatform("admin"), true);
});
