import { randomUUID } from 'node:crypto';

import type { LearningSessionStatus } from './learning-session-status.js';

export const LearningSessionDomainEventName = {
  STARTED: 'learning.session.started',
  PAUSED: 'learning.session.paused',
  RESUMED: 'learning.session.resumed',
  COMPLETED: 'learning.session.completed',
  ABANDONED: 'learning.session.abandoned',
} as const;

export type LearningSessionDomainEventName =
  (typeof LearningSessionDomainEventName)[keyof typeof LearningSessionDomainEventName];

export interface LearningSessionStartedPayload {
  readonly sessionId: string;
  readonly enrollmentId: string;
  readonly status: LearningSessionStatus;
  readonly startedAt: Date;
}

export interface LearningSessionLifecyclePayload {
  readonly sessionId: string;
  readonly enrollmentId: string;
  readonly previousStatus: LearningSessionStatus;
  readonly currentStatus: LearningSessionStatus;
}

export interface LearningSessionDomainEvent<
  TEventName extends LearningSessionDomainEventName =
    LearningSessionDomainEventName,
  TPayload = unknown,
> {
  readonly eventId: string;
  readonly eventName: TEventName;
  readonly eventVersion: number;
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly payload: TPayload;
}

export type LearningSessionStartedEvent = LearningSessionDomainEvent<
  typeof LearningSessionDomainEventName.STARTED,
  LearningSessionStartedPayload
>;

export type LearningSessionPausedEvent = LearningSessionDomainEvent<
  typeof LearningSessionDomainEventName.PAUSED,
  LearningSessionLifecyclePayload
>;

export type LearningSessionResumedEvent = LearningSessionDomainEvent<
  typeof LearningSessionDomainEventName.RESUMED,
  LearningSessionLifecyclePayload
>;

export type LearningSessionCompletedEvent = LearningSessionDomainEvent<
  typeof LearningSessionDomainEventName.COMPLETED,
  LearningSessionLifecyclePayload
>;

export type LearningSessionAbandonedEvent = LearningSessionDomainEvent<
  typeof LearningSessionDomainEventName.ABANDONED,
  LearningSessionLifecyclePayload
>;

export type LearningSessionEvent =
  | LearningSessionStartedEvent
  | LearningSessionPausedEvent
  | LearningSessionResumedEvent
  | LearningSessionCompletedEvent
  | LearningSessionAbandonedEvent;

function createEvent<
  TEventName extends LearningSessionDomainEventName,
  TPayload,
>(
  eventName: TEventName,
  aggregateId: string,
  payload: TPayload,
  occurredAt: Date,
): LearningSessionDomainEvent<TEventName, TPayload> {
  return {
    eventId: randomUUID(),
    eventName,
    eventVersion: 1,
    aggregateId,
    occurredAt: new Date(occurredAt),
    payload: structuredClone(payload),
  };
}

export function createLearningSessionStartedEvent(
  aggregateId: string,
  payload: LearningSessionStartedPayload,
  occurredAt: Date,
): LearningSessionStartedEvent {
  return createEvent(
    LearningSessionDomainEventName.STARTED,
    aggregateId,
    payload,
    occurredAt,
  );
}

export function createLearningSessionPausedEvent(
  aggregateId: string,
  payload: LearningSessionLifecyclePayload,
  occurredAt: Date,
): LearningSessionPausedEvent {
  return createEvent(
    LearningSessionDomainEventName.PAUSED,
    aggregateId,
    payload,
    occurredAt,
  );
}

export function createLearningSessionResumedEvent(
  aggregateId: string,
  payload: LearningSessionLifecyclePayload,
  occurredAt: Date,
): LearningSessionResumedEvent {
  return createEvent(
    LearningSessionDomainEventName.RESUMED,
    aggregateId,
    payload,
    occurredAt,
  );
}

export function createLearningSessionCompletedEvent(
  aggregateId: string,
  payload: LearningSessionLifecyclePayload,
  occurredAt: Date,
): LearningSessionCompletedEvent {
  return createEvent(
    LearningSessionDomainEventName.COMPLETED,
    aggregateId,
    payload,
    occurredAt,
  );
}

export function createLearningSessionAbandonedEvent(
  aggregateId: string,
  payload: LearningSessionLifecyclePayload,
  occurredAt: Date,
): LearningSessionAbandonedEvent {
  return createEvent(
    LearningSessionDomainEventName.ABANDONED,
    aggregateId,
    payload,
    occurredAt,
  );
}
