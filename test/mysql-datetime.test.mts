import test from "node:test";
import assert from "node:assert/strict";

import { toMysqlDateTime } from "../lib/repositories/mysql/mysql-datetime.ts";

test("toMysqlDateTime converts ISO values into MySQL DATETIME format", () => {
  assert.equal(toMysqlDateTime("2026-03-16T04:36:52.307Z"), "2026-03-16 04:36:52");
});

test("toMysqlDateTime rejects invalid values", () => {
  assert.throws(() => toMysqlDateTime("not-a-date"), /Invalid datetime value/);
});
