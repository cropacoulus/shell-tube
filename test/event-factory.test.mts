import assert from "node:assert/strict";
import test from "node:test";

import { createDomainEvent } from "../lib/events/event-factory.ts";
import { buildEventIdempotencyKey } from "../lib/events/idempotency.ts";

test("createDomainEvent builds a typed event envelope", () => {
  const event = createDomainEvent({
    type: "creator_application_submitted",
    aggregateType: "creator_application",
    aggregateId: "creator_app_123",
    actor: {
      userId: "user_123",
      role: "student",
    },
    idempotencyKey: buildEventIdempotencyKey("creator-application-submit", "user_123"),
    payload: {
      applicationId: "creator_app_123",
      status: "pending",
    },
  });

  assert.match(event.id, /^evt_/);
  assert.equal(event.type, "creator_application_submitted");
  assert.equal(event.aggregateType, "creator_application");
  assert.equal(event.aggregateId, "creator_app_123");
  assert.equal(event.actorUserId, "user_123");
  assert.equal(event.actorRole, "student");
  assert.equal(event.version, 1);
  assert.equal(typeof event.occurredAt, "string");
  assert.equal(event.idempotencyKey, "creator-application-submit:user_123");
});

test("buildEventIdempotencyKey skips empty values", () => {
  const key = buildEventIdempotencyKey("payout-settle", "ledger_1", undefined, "", "settled");
  assert.equal(key, "payout-settle:ledger_1:settled");
});
