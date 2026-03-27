import type { CreateDomainEventInput, DomainEvent } from "@/lib/events/contracts";

export function createDomainEvent<TType extends DomainEvent["type"], TPayload, TAggregateType extends DomainEvent["aggregateType"]>(
  input: CreateDomainEventInput<TType, TPayload, TAggregateType>,
): DomainEvent<TType, TPayload, TAggregateType> {
  return {
    id: `evt_${crypto.randomUUID().slice(0, 12)}`,
    type: input.type,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    occurredAt: new Date().toISOString(),
    actorUserId: input.actor?.userId,
    actorRole: input.actor?.role,
    correlationId: input.correlationId,
    causationId: input.causationId,
    idempotencyKey: input.idempotencyKey,
    version: 1,
    payload: input.payload,
  };
}
