import type { DomainAggregateType, DomainEventType } from "@/lib/events/event-types";
import type { DomainEvent } from "@/lib/events/contracts";

export type EventStoreListFilters = {
  aggregateType?: DomainAggregateType;
  aggregateId?: string;
  type?: DomainEventType;
  limit?: number;
};

export type EventStore = {
  appendEvent(event: DomainEvent): Promise<void>;
  appendEvents(events: DomainEvent[]): Promise<void>;
  listEvents(filters?: EventStoreListFilters): Promise<DomainEvent[]>;
};
