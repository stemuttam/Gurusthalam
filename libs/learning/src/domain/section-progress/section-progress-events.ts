import { randomUUID } from 'node:crypto';

import type { SectionProgressStatus } from './section-progress-status.js';

export const SectionProgressDomainEventName = {
  STARTED: 'learning.section.progress.started',
  UPDATED: 'learning.section.progress.updated',
  COMPLETED: 'learning.section.progress.completed',
} as const;

export type SectionProgressDomainEventName =
  (typeof SectionProgressDomainEventName)[keyof typeof SectionProgressDomainEventName];

export interface SectionProgressStartedPayload {
  readonly sectionProgressId: string;
  readonly enrollmentId: string;
  readonly sectionId: string;
  readonly status: SectionProgressStatus;
  readonly percentage: number;
  readonly startedAt: Date;
}

export interface SectionProgressUpdatedPayload {
  readonly sectionProgressId: string;
  readonly enrollmentId: string;
  readonly sectionId: string;
  readonly previousPercentage: number;
  readonly currentPercentage: number;
  readonly previousStatus: SectionProgressStatus;
  readonly currentStatus: SectionProgressStatus;
}

export interface SectionProgressCompletedPayload {
  readonly sectionProgressId: string;
  readonly enrollmentId: string;
  readonly sectionId: string;
  readonly previousStatus: SectionProgressStatus;
  readonly currentStatus: SectionProgressStatus;
  readonly percentage: number;
  readonly completedAt: Date;
}

export interface SectionProgressDomainEvent<
  TEventName extends SectionProgressDomainEventName =
    SectionProgressDomainEventName,
  TPayload = unknown,
> {
  readonly eventId: string;
  readonly eventName: TEventName;
  readonly eventVersion: number;
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly payload: TPayload;
}

export type SectionProgressStartedEvent = SectionProgressDomainEvent<
  typeof SectionProgressDomainEventName.STARTED,
  SectionProgressStartedPayload
>;

export type SectionProgressUpdatedEvent = SectionProgressDomainEvent<
  typeof SectionProgressDomainEventName.UPDATED,
  SectionProgressUpdatedPayload
>;

export type SectionProgressCompletedEvent = SectionProgressDomainEvent<
  typeof SectionProgressDomainEventName.COMPLETED,
  SectionProgressCompletedPayload
>;

export type SectionProgressEvent =
  | SectionProgressStartedEvent
  | SectionProgressUpdatedEvent
  | SectionProgressCompletedEvent;

function createEvent<
  TEventName extends SectionProgressDomainEventName,
  TPayload,
>(
  eventName: TEventName,
  aggregateId: string,
  payload: TPayload,
  occurredAt: Date,
): SectionProgressDomainEvent<TEventName, TPayload> {
  return {
    eventId: randomUUID(),
    eventName,
    eventVersion: 1,
    aggregateId,
    occurredAt: new Date(occurredAt),
    payload: structuredClone(payload),
  };
}

export function createSectionProgressStartedEvent(
  aggregateId: string,
  payload: SectionProgressStartedPayload,
  occurredAt: Date,
): SectionProgressStartedEvent {
  return createEvent(
    SectionProgressDomainEventName.STARTED,
    aggregateId,
    payload,
    occurredAt,
  );
}

export function createSectionProgressUpdatedEvent(
  aggregateId: string,
  payload: SectionProgressUpdatedPayload,
  occurredAt: Date,
): SectionProgressUpdatedEvent {
  return createEvent(
    SectionProgressDomainEventName.UPDATED,
    aggregateId,
    payload,
    occurredAt,
  );
}

export function createSectionProgressCompletedEvent(
  aggregateId: string,
  payload: SectionProgressCompletedPayload,
  occurredAt: Date,
): SectionProgressCompletedEvent {
  return createEvent(
    SectionProgressDomainEventName.COMPLETED,
    aggregateId,
    payload,
    occurredAt,
  );
}
