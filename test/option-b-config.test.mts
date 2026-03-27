import assert from "node:assert/strict";
import test from "node:test";

import { createOptionBConfig } from "../lib/runtime/option-b-config.ts";

test("createOptionBConfig normalizes supported backends", () => {
  const config = createOptionBConfig({
    OPTION_B_EVENT_STORE_BACKEND: "upstash",
    OPTION_B_PROJECTION_STORE_BACKEND: "upstash",
    UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "token_123",
    CRON_SECRET: "secret_123",
  });

  assert.equal(config.eventStoreBackend, "upstash");
  assert.equal(config.projectionStoreBackend, "upstash");
  assert.equal(config.upstashRedisRestUrl, "https://example.upstash.io");
  assert.equal(config.upstashRedisRestToken, "token_123");
  assert.equal(config.cronSecret, "secret_123");
});

test("createOptionBConfig falls back to local-safe defaults", () => {
  const config = createOptionBConfig({});
  assert.equal(config.eventStoreBackend, "json");
  assert.equal(config.projectionStoreBackend, "memory");
});
