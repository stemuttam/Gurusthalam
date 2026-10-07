import { randomUUID } from 'node:crypto';

import type { ProgressStatus } from './progress-status.js';

export const ProgressDomainEventName = {
  STARTED: 'learning.progress.started',
  UPDATED: 'learning.progress.updated',
  COMPLETED: 'learning.progress.completed',
} as const;

export type ProgressDomainEventName =
  (typeof ProgressDomainEventName)[keyof typeof ProgressDomainEventName];

export interface ProgressStartedPayload {
  readonly progressId: string;
  readonly enrollmentId: string;
  readonly status: ProgressStatus;
  readonly percentage: number;
  readonly startedAt: Date;
}

export interface ProgressUpdatedPayload {
  readonly progressId: string;
  readonly enrollmentId: string;
  readonly previousPercentage: number;
  readonly currentPercentage: number;
  readonly previousStatus: ProgressStatus;
  readonly currentStatus: ProgressStatus;
}

export interface ProgressCompletedPayload {
  readonly progressId: string;
  readonly enrollmentId: string;
  readonly previousStatus: ProgressStatus;
  readonly currentStatus: ProgressStatus;
  readonly percentage: number;
  readonly completedAt: Date;
}

export interface ProgressDomainEvent<
  TEventName extends ProgressDomainEventName = ProgressDomainEventName,
  TPayload = unknown,
> {
  readonly eventId: string;
  readonly eventName: TEventName;
  readonly eventVersion: number;
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly payload: TPayload;
}

export type ProgressStartedEvent = ProgressDomainEvent<
  typeof ProgressDomainEventName.STARTED,
  ProgressStartedPayload
>;

export type ProgressUpdatedEvent = ProgressDomainEvent<
  typeof ProgressDomainEventName.UPDATED,
  ProgressUpdatedPayload
>;

export type ProgressCompletedEvent = ProgressDomainEvent<
  typeof ProgressDomainEventName.COMPLETED,
  ProgressCompletedPayload
>;

export type ProgressEvent =
  ProgressStartedEvent | ProgressUpdatedEvent | ProgressCompletedEvent;

function createEvent<TEventName extends ProgressDomainEventName, TPayload>(
  eventName: TEventName,
  aggregateId: string,
  payload: TPayload,
  occurredAt: Date,
): ProgressDomainEvent<TEventName, TPayload> {
  return {
    eventId: randomUUID(),
    eventName,
    eventVersion: 1,
    aggregateId,
    occurredAt: new Date(occurredAt),
    payload: structuredClone(payload),
  };
}

export function createProgressStartedEvent(
  aggregateId: string,
  payload: ProgressStartedPayload,
  occurredAt: Date,
): ProgressStartedEvent {
  return createEvent(
    ProgressDomainEventName.STARTED,
    aggregateId,
    payload,
    occurredAt,
  );
}

export function createProgressUpdatedEvent(
  aggregateId: string,
  payload: ProgressUpdatedPayload,
  occurredAt: Date,
): ProgressUpdatedEvent {
  return createEvent(
    ProgressDomainEventName.UPDATED,
    aggregateId,
    payload,
    occurredAt,
  );
}

export function createProgressCompletedEvent(
  aggregateId: string,
  payload: ProgressCompletedPayload,
  occurredAt: Date,
): ProgressCompletedEvent {
  return createEvent(
    ProgressDomainEventName.COMPLETED,
    aggregateId,
    payload,
    occurredAt,
  );
}
