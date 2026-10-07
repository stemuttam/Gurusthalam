import { randomUUID } from 'node:crypto';

import type { LessonProgressStatus } from './lesson-progress-status.js';

export const LessonProgressDomainEventName = {
  STARTED: 'learning.lesson.progress.started',
  UPDATED: 'learning.lesson.progress.updated',
  COMPLETED: 'learning.lesson.progress.completed',
} as const;

export type LessonProgressDomainEventName =
  (typeof LessonProgressDomainEventName)[keyof typeof LessonProgressDomainEventName];

export interface LessonProgressStartedPayload {
  readonly lessonProgressId: string;
  readonly enrollmentId: string;
  readonly learningUnitId: string;
  readonly status: LessonProgressStatus;
  readonly percentage: number;
  readonly startedAt: Date;
}

export interface LessonProgressUpdatedPayload {
  readonly lessonProgressId: string;
  readonly enrollmentId: string;
  readonly learningUnitId: string;
  readonly previousPercentage: number;
  readonly currentPercentage: number;
  readonly previousStatus: LessonProgressStatus;
  readonly currentStatus: LessonProgressStatus;
}

export interface LessonProgressCompletedPayload {
  readonly lessonProgressId: string;
  readonly enrollmentId: string;
  readonly learningUnitId: string;
  readonly previousStatus: LessonProgressStatus;
  readonly currentStatus: LessonProgressStatus;
  readonly percentage: number;
  readonly completedAt: Date;
}

export interface LessonProgressDomainEvent<
  TEventName extends LessonProgressDomainEventName =
    LessonProgressDomainEventName,
  TPayload = unknown,
> {
  readonly eventId: string;
  readonly eventName: TEventName;
  readonly eventVersion: number;
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly payload: TPayload;
}

export type LessonProgressStartedEvent = LessonProgressDomainEvent<
  typeof LessonProgressDomainEventName.STARTED,
  LessonProgressStartedPayload
>;

export type LessonProgressUpdatedEvent = LessonProgressDomainEvent<
  typeof LessonProgressDomainEventName.UPDATED,
  LessonProgressUpdatedPayload
>;

export type LessonProgressCompletedEvent = LessonProgressDomainEvent<
  typeof LessonProgressDomainEventName.COMPLETED,
  LessonProgressCompletedPayload
>;

export type LessonProgressEvent =
  | LessonProgressStartedEvent
  | LessonProgressUpdatedEvent
  | LessonProgressCompletedEvent;

function createEvent<
  TEventName extends LessonProgressDomainEventName,
  TPayload,
>(
  eventName: TEventName,
  aggregateId: string,
  payload: TPayload,
  occurredAt: Date,
): LessonProgressDomainEvent<TEventName, TPayload> {
  return {
    eventId: randomUUID(),
    eventName,
    eventVersion: 1,
    aggregateId,
    occurredAt: new Date(occurredAt),
    payload: structuredClone(payload),
  };
}

export function createLessonProgressStartedEvent(
  aggregateId: string,
  payload: LessonProgressStartedPayload,
  occurredAt: Date,
): LessonProgressStartedEvent {
  return createEvent(
    LessonProgressDomainEventName.STARTED,
    aggregateId,
    payload,
    occurredAt,
  );
}

export function createLessonProgressUpdatedEvent(
  aggregateId: string,
  payload: LessonProgressUpdatedPayload,
  occurredAt: Date,
): LessonProgressUpdatedEvent {
  return createEvent(
    LessonProgressDomainEventName.UPDATED,
    aggregateId,
    payload,
    occurredAt,
  );
}

export function createLessonProgressCompletedEvent(
  aggregateId: string,
  payload: LessonProgressCompletedPayload,
  occurredAt: Date,
): LessonProgressCompletedEvent {
  return createEvent(
    LessonProgressDomainEventName.COMPLETED,
    aggregateId,
    payload,
    occurredAt,
  );
}
