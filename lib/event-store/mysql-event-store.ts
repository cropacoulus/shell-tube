import type { DomainEvent } from "@/lib/events/contracts";
import type { EventStore } from "@/lib/event-store/event-store";
import { getMySqlPool } from "@/lib/repositories/mysql/mysql-connection";
import { toMysqlDateTime } from "@/lib/repositories/mysql/mysql-datetime";

type DomainEventRow = {
  id: string;
  type: DomainEvent["type"];
  aggregate_type: DomainEvent["aggregateType"];
  aggregate_id: string;
  occurred_at: string | Date;
  actor_user_id: string | null;
  actor_role: DomainEvent["actorRole"] | null;
  correlation_id: string | null;
  causation_id: string | null;
  idempotency_key: string | null;
  payload_json: string;
  version: number;
};

function toIsoString(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapRow(row: DomainEventRow): DomainEvent {
  return {
    id: row.id,
    type: row.type,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    occurredAt: toIsoString(row.occurred_at),
    actorUserId: row.actor_user_id ?? undefined,
    actorRole: row.actor_role ?? undefined,
    correlationId: row.correlation_id ?? undefined,
    causationId: row.causation_id ?? undefined,
    idempotencyKey: row.idempotency_key ?? undefined,
    payload: JSON.parse(row.payload_json),
    version: row.version as 1,
  };
}

async function appendOne(event: DomainEvent) {
  const pool = await getMySqlPool();
  await pool.execute(
    `INSERT INTO domain_events
     (id, type, aggregate_type, aggregate_id, occurred_at, actor_user_id, actor_role, correlation_id, causation_id, idempotency_key, payload_json, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      event.id,
      event.type,
      event.aggregateType,
      event.aggregateId,
      toMysqlDateTime(event.occurredAt),
      event.actorUserId ?? null,
      event.actorRole ?? null,
      event.correlationId ?? null,
      event.causationId ?? null,
      event.idempotencyKey ?? null,
      JSON.stringify(event.payload),
      event.version,
    ],
  );
}

export const mysqlEventStore: EventStore = {
  async appendEvent(event) {
    await appendOne(event);
  },
  async appendEvents(events) {
    for (const event of events) {
      await appendOne(event);
    }
  },
  async listEvents(filters) {
    const pool = await getMySqlPool();
    const where: string[] = [];
    const params: unknown[] = [];

    if (filters?.aggregateType) {
      where.push("aggregate_type = ?");
      params.push(filters.aggregateType);
    }
    if (filters?.aggregateId) {
      where.push("aggregate_id = ?");
      params.push(filters.aggregateId);
    }
    if (filters?.type) {
      where.push("type = ?");
      params.push(filters.type);
    }

    const sql = [
      "SELECT id, type, aggregate_type, aggregate_id, occurred_at, actor_user_id, actor_role, correlation_id, causation_id, idempotency_key, payload_json, version",
      "FROM domain_events",
      where.length > 0 ? `WHERE ${where.join(" AND ")}` : "",
      "ORDER BY occurred_at DESC, id DESC",
      filters?.limit ? `LIMIT ${Math.max(1, filters.limit)}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const [rows] = await pool.execute(sql, params);
    return (rows as DomainEventRow[]).map(mapRow);
  },
};
