import type { DomainEvent } from "@/lib/events/contracts";
import type { EventStore, EventStoreListFilters } from "@/lib/event-store/event-store";
import { appendDomainEvents, listDomainEvents } from "@/lib/server/data-store";

function filterEvents(events: DomainEvent[], filters?: EventStoreListFilters) {
  return events
    .filter((event) => (filters?.aggregateType ? event.aggregateType === filters.aggregateType : true))
    .filter((event) => (filters?.aggregateId ? event.aggregateId === filters.aggregateId : true))
    .filter((event) => (filters?.type ? event.type === filters.type : true))
    .slice(0, filters?.limit ?? events.length);
}

export const jsonEventStore: EventStore = {
  async appendEvent(event) {
    await appendDomainEvents([event]);
  },
  async appendEvents(events) {
    if (events.length === 0) return;
    await appendDomainEvents(events);
  },
  async listEvents(filters) {
    const events = await listDomainEvents();
    return filterEvents(events, filters);
  },
};
