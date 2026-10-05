import { randomUUID } from 'node:crypto';

import type { EnrollmentSource } from './enrollment-source.js';

import type { EnrollmentStatus } from './enrollment-status.js';

export const EnrollmentDomainEventName = {
  CREATED: 'learning.enrollment.created',
  ACTIVATED: 'learning.enrollment.activated',
  CANCELLED: 'learning.enrollment.cancelled',
  EXPIRED: 'learning.enrollment.expired',
  COMPLETED: 'learning.enrollment.completed',
} as const;

export type EnrollmentDomainEventName =
  (typeof EnrollmentDomainEventName)[keyof typeof EnrollmentDomainEventName];

export interface EnrollmentCreatedPayload {
  readonly enrollmentId: string;
  readonly learnerId: string;
  readonly courseId: string;
  readonly courseVersionId: string;
  readonly status: EnrollmentStatus;
  readonly source: EnrollmentSource;
  readonly startsAt: Date;
  readonly expiresAt: Date | null;
}

export interface EnrollmentLifecyclePayload {
  readonly enrollmentId: string;
  readonly learnerId: string;
  readonly courseId: string;
  readonly courseVersionId: string;
  readonly previousStatus: EnrollmentStatus;
  readonly currentStatus: EnrollmentStatus;
}

export interface EnrollmentDomainEvent<
  TEventName extends EnrollmentDomainEventName = EnrollmentDomainEventName,
  TPayload = unknown,
> {
  readonly eventId: string;
  readonly eventName: TEventName;
  readonly eventVersion: number;
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly payload: TPayload;
}

export type EnrollmentCreatedEvent = EnrollmentDomainEvent<
  typeof EnrollmentDomainEventName.CREATED,
  EnrollmentCreatedPayload
>;

export type EnrollmentActivatedEvent = EnrollmentDomainEvent<
  typeof EnrollmentDomainEventName.ACTIVATED,
  EnrollmentLifecyclePayload
>;

export type EnrollmentCancelledEvent = EnrollmentDomainEvent<
  typeof EnrollmentDomainEventName.CANCELLED,
  EnrollmentLifecyclePayload
>;

export type EnrollmentExpiredEvent = EnrollmentDomainEvent<
  typeof EnrollmentDomainEventName.EXPIRED,
  EnrollmentLifecyclePayload
>;

export type EnrollmentCompletedEvent = EnrollmentDomainEvent<
  typeof EnrollmentDomainEventName.COMPLETED,
  EnrollmentLifecyclePayload
>;

export type EnrollmentEvent =
  | EnrollmentCreatedEvent
  | EnrollmentActivatedEvent
  | EnrollmentCancelledEvent
  | EnrollmentExpiredEvent
  | EnrollmentCompletedEvent;

function createEvent<TEventName extends EnrollmentDomainEventName, TPayload>(
  eventName: TEventName,
  aggregateId: string,
  payload: TPayload,
  occurredAt: Date,
): EnrollmentDomainEvent<TEventName, TPayload> {
  return {
    eventId: randomUUID(),
    eventName,
    eventVersion: 1,
    aggregateId,
    occurredAt: new Date(occurredAt),
    payload: structuredClone(payload),
  };
}

export function createEnrollmentCreatedEvent(
  aggregateId: string,
  payload: EnrollmentCreatedPayload,
  occurredAt: Date,
): EnrollmentCreatedEvent {
  return createEvent(
    EnrollmentDomainEventName.CREATED,
    aggregateId,
    payload,
    occurredAt,
  );
}

export function createEnrollmentActivatedEvent(
  aggregateId: string,
  payload: EnrollmentLifecyclePayload,
  occurredAt: Date,
): EnrollmentActivatedEvent {
  return createEvent(
    EnrollmentDomainEventName.ACTIVATED,
    aggregateId,
    payload,
    occurredAt,
  );
}

export function createEnrollmentCancelledEvent(
  aggregateId: string,
  payload: EnrollmentLifecyclePayload,
  occurredAt: Date,
): EnrollmentCancelledEvent {
  return createEvent(
    EnrollmentDomainEventName.CANCELLED,
    aggregateId,
    payload,
    occurredAt,
  );
}

export function createEnrollmentExpiredEvent(
  aggregateId: string,
  payload: EnrollmentLifecyclePayload,
  occurredAt: Date,
): EnrollmentExpiredEvent {
  return createEvent(
    EnrollmentDomainEventName.EXPIRED,
    aggregateId,
    payload,
    occurredAt,
  );
}

export function createEnrollmentCompletedEvent(
  aggregateId: string,
  payload: EnrollmentLifecyclePayload,
  occurredAt: Date,
): EnrollmentCompletedEvent {
  return createEvent(
    EnrollmentDomainEventName.COMPLETED,
    aggregateId,
    payload,
    occurredAt,
  );
}
