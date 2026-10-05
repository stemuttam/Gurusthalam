import { randomUUID } from 'node:crypto';

import type { EntitlementSource } from './entitlement-source.js';
import type { EntitlementStatus } from './entitlement-status.js';

export const EntitlementDomainEventName = {
  GRANTED: 'learning.entitlement.granted',
  SUSPENDED: 'learning.entitlement.suspended',
  RESTORED: 'learning.entitlement.restored',
  REVOKED: 'learning.entitlement.revoked',
  EXPIRED: 'learning.entitlement.expired',
} as const;

export type EntitlementDomainEventName =
  (typeof EntitlementDomainEventName)[keyof typeof EntitlementDomainEventName];

export interface EntitlementGrantedPayload {
  readonly entitlementId: string;
  readonly enrollmentId: string;
  readonly source: EntitlementSource;
  readonly status: EntitlementStatus;
  readonly startsAt: Date;
  readonly expiresAt: Date | null;
}

export interface EntitlementLifecyclePayload {
  readonly entitlementId: string;
  readonly enrollmentId: string;
  readonly previousStatus: EntitlementStatus;
  readonly currentStatus: EntitlementStatus;
}

export interface EntitlementDomainEvent<
  TEventName extends EntitlementDomainEventName = EntitlementDomainEventName,
  TPayload = unknown,
> {
  readonly eventId: string;
  readonly eventName: TEventName;
  readonly eventVersion: number;
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly payload: TPayload;
}

export type EntitlementGrantedEvent = EntitlementDomainEvent<
  typeof EntitlementDomainEventName.GRANTED,
  EntitlementGrantedPayload
>;

export type EntitlementSuspendedEvent = EntitlementDomainEvent<
  typeof EntitlementDomainEventName.SUSPENDED,
  EntitlementLifecyclePayload
>;

export type EntitlementRestoredEvent = EntitlementDomainEvent<
  typeof EntitlementDomainEventName.RESTORED,
  EntitlementLifecyclePayload
>;

export type EntitlementRevokedEvent = EntitlementDomainEvent<
  typeof EntitlementDomainEventName.REVOKED,
  EntitlementLifecyclePayload
>;

export type EntitlementExpiredEvent = EntitlementDomainEvent<
  typeof EntitlementDomainEventName.EXPIRED,
  EntitlementLifecyclePayload
>;

export type EntitlementEvent =
  | EntitlementGrantedEvent
  | EntitlementSuspendedEvent
  | EntitlementRestoredEvent
  | EntitlementRevokedEvent
  | EntitlementExpiredEvent;

function createEvent<TEventName extends EntitlementDomainEventName, TPayload>(
  eventName: TEventName,
  aggregateId: string,
  payload: TPayload,
  occurredAt: Date,
): EntitlementDomainEvent<TEventName, TPayload> {
  return {
    eventId: randomUUID(),
    eventName,
    eventVersion: 1,
    aggregateId,
    occurredAt: new Date(occurredAt),
    payload: structuredClone(payload),
  };
}

export function createEntitlementGrantedEvent(
  aggregateId: string,
  payload: EntitlementGrantedPayload,
  occurredAt: Date,
): EntitlementGrantedEvent {
  return createEvent(
    EntitlementDomainEventName.GRANTED,
    aggregateId,
    payload,
    occurredAt,
  );
}

export function createEntitlementSuspendedEvent(
  aggregateId: string,
  payload: EntitlementLifecyclePayload,
  occurredAt: Date,
): EntitlementSuspendedEvent {
  return createEvent(
    EntitlementDomainEventName.SUSPENDED,
    aggregateId,
    payload,
    occurredAt,
  );
}

export function createEntitlementRestoredEvent(
  aggregateId: string,
  payload: EntitlementLifecyclePayload,
  occurredAt: Date,
): EntitlementRestoredEvent {
  return createEvent(
    EntitlementDomainEventName.RESTORED,
    aggregateId,
    payload,
    occurredAt,
  );
}

export function createEntitlementRevokedEvent(
  aggregateId: string,
  payload: EntitlementLifecyclePayload,
  occurredAt: Date,
): EntitlementRevokedEvent {
  return createEvent(
    EntitlementDomainEventName.REVOKED,
    aggregateId,
    payload,
    occurredAt,
  );
}

export function createEntitlementExpiredEvent(
  aggregateId: string,
  payload: EntitlementLifecyclePayload,
  occurredAt: Date,
): EntitlementExpiredEvent {
  return createEvent(
    EntitlementDomainEventName.EXPIRED,
    aggregateId,
    payload,
    occurredAt,
  );
}
