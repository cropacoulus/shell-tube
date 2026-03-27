import type { DomainEvent } from "@/lib/events/contracts";
import type { EventStore, EventStoreListFilters } from "@/lib/event-store/event-store";
import { runUpstashCommand } from "@/lib/upstash/rest-client";

type UpstashStreamEntry = [string, string[]];

const GLOBAL_STREAM_KEY = "stream:events:all";

function serializeEvent(event: DomainEvent) {
  return JSON.stringify(event);
}

function parseEntry(entry: UpstashStreamEntry): DomainEvent {
  const [, fields] = entry;
  const payload = fields[1];
  return JSON.parse(payload) as DomainEvent;
}

async function xadd(streamKey: string, event: DomainEvent) {
  await runUpstashCommand(["XADD", streamKey, "*", "event", serializeEvent(event)]);
}

export const upstashEventStore: EventStore = {
  async appendEvent(event) {
    await xadd(GLOBAL_STREAM_KEY, event);
  },
  async appendEvents(events) {
    for (const event of events) {
      await xadd(GLOBAL_STREAM_KEY, event);
    }
  },
  async listEvents(filters?: EventStoreListFilters) {
    const count = String(Math.max(1, filters?.limit ?? 200));
    const entries = (await runUpstashCommand<UpstashStreamEntry[]>([
      "XREVRANGE",
      GLOBAL_STREAM_KEY,
      "+",
      "-",
      "COUNT",
      count,
    ])) ?? [];

    return entries
      .map(parseEntry)
      .filter((event) => (filters?.aggregateType ? event.aggregateType === filters.aggregateType : true))
      .filter((event) => (filters?.aggregateId ? event.aggregateId === filters.aggregateId : true))
      .filter((event) => (filters?.type ? event.type === filters.type : true));
  },
};
