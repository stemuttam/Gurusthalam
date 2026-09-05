import { randomUUID } from 'node:crypto';

export interface DomainEvent<
  TEventName extends string = string,
  TPayload = unknown,
> {
  readonly eventId: string;
  readonly eventName: TEventName;
  readonly eventVersion: number;
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly payload: TPayload;
}

export function createDomainEvent<
  TEventName extends string,
  TPayload,
>(
  eventName: TEventName,
  aggregateId: string,
  payload: TPayload,
): DomainEvent<TEventName, TPayload> {
  return {
    eventId: randomUUID(),
    eventName,
    eventVersion: 1,
    aggregateId,
    occurredAt: new Date(),
    payload: structuredClone(payload),
  };
}