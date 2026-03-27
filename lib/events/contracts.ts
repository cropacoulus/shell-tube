import type { DomainAggregateType, DomainEventActor, DomainEventType } from "@/lib/events/event-types";

export type DomainEvent<
  TType extends DomainEventType = DomainEventType,
  TPayload = unknown,
  TAggregateType extends DomainAggregateType = DomainAggregateType,
> = {
  id: string;
  type: TType;
  aggregateType: TAggregateType;
  aggregateId: string;
  occurredAt: string;
  actorUserId?: string;
  actorRole?: DomainEventActor["role"];
  correlationId?: string;
  causationId?: string;
  idempotencyKey?: string;
  version: 1;
  payload: TPayload;
};

export type CreateDomainEventInput<
  TType extends DomainEventType = DomainEventType,
  TPayload = unknown,
  TAggregateType extends DomainAggregateType = DomainAggregateType,
> = {
  type: TType;
  aggregateType: TAggregateType;
  aggregateId: string;
  actor?: DomainEventActor;
  correlationId?: string;
  causationId?: string;
  idempotencyKey?: string;
  payload: TPayload;
};
