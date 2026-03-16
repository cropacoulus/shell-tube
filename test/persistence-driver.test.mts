import test from "node:test";
import assert from "node:assert/strict";

import {
  createPersistenceConfig,
  getPersistenceDriver,
} from "../lib/repositories/persistence-config.ts";

test("getPersistenceDriver defaults to json", () => {
  assert.equal(getPersistenceDriver(undefined), "json");
  assert.equal(getPersistenceDriver(""), "json");
});

test("getPersistenceDriver accepts mysql explicitly", () => {
  assert.equal(getPersistenceDriver("mysql"), "mysql");
});

test("createPersistenceConfig normalizes env into a stable config", () => {
  const config = createPersistenceConfig({
    PERSISTENCE_DRIVER: "mysql",
    DATABASE_URL: "mysql://user:pass@localhost:3306/app",
  });

  assert.equal(config.driver, "mysql");
  assert.equal(config.databaseUrl, "mysql://user:pass@localhost:3306/app");
});
