import test from "node:test";
import assert from "node:assert/strict";

import {
  parseMySqlDatabaseUrl,
} from "../lib/repositories/mysql/mysql-connection.ts";

test("parseMySqlDatabaseUrl extracts connection fields", () => {
  const parsed = parseMySqlDatabaseUrl("mysql://user:pass@localhost:3307/stream_p2p");

  assert.equal(parsed.host, "localhost");
  assert.equal(parsed.port, 3307);
  assert.equal(parsed.user, "user");
  assert.equal(parsed.password, "pass");
  assert.equal(parsed.database, "stream_p2p");
});

test("parseMySqlDatabaseUrl rejects non-mysql schemes", () => {
  assert.throws(
    () => parseMySqlDatabaseUrl("postgres://user:pass@localhost:5432/app"),
    /mysql/i,
  );
});
