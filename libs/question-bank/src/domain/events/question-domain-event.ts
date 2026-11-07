
import { randomUUID } from 'node:crypto';

import type { QuestionId } from '../identifiers/question-id.js';
import type { QuestionVersionId } from '../identifiers/question-version-id.js';
import type { QuestionVersionNumber } from '../identifiers/question-version-number.js';
import type { QuestionOwnership } from '../ownership/question-ownership.js';

export const QUESTION_DOMAIN_EVENT_VERSION = 1 as const;

export interface QuestionDomainEventBase<
  TEventName extends string,
  TPayload,
> {
  readonly eventId: string;
  readonly eventName: TEventName;
  readonly eventVersion: typeof QUESTION_DOMAIN_EVENT_VERSION;
  readonly aggregateType: 'Question';
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly payload: Readonly<TPayload>;
}

export interface QuestionCreatedPayload {
  readonly questionId: string;
  readonly questionVersionId: string;
  readonly versionNumber: number;
  readonly tenantId: string;
  readonly createdByPrincipalId: string;
}

export interface QuestionRevisedPayload {
  readonly questionId: string;
  readonly questionVersionId: string;
  readonly versionNumber: number;
  readonly previousVersionId: string;
  readonly tenantId: string;
  readonly actorPrincipalId: string;
}

export interface QuestionRestoredPayload {
  readonly questionId: string;
  readonly questionVersionId: string;
  readonly versionNumber: number;
  readonly previousVersionId: string;
  readonly restoredFromVersionId: string;
  readonly tenantId: string;
  readonly actorPrincipalId: string;
}

export type QuestionCreatedEvent = QuestionDomainEventBase<
  'QuestionCreated',
  QuestionCreatedPayload
>;

export type QuestionRevisedEvent = QuestionDomainEventBase<
  'QuestionRevised',
  QuestionRevisedPayload
>;

export type QuestionRestoredEvent = QuestionDomainEventBase<
  'QuestionRestored',
  QuestionRestoredPayload
>;

export type QuestionDomainEvent =
  | QuestionCreatedEvent
  | QuestionRevisedEvent
  | QuestionRestoredEvent;

function createEnvelope<TEventName extends string, TPayload>(
  eventName: TEventName,
  aggregateId: string,
  payload: TPayload,
  occurredAt: Date,
): QuestionDomainEventBase<TEventName, TPayload> {
  if (
    typeof aggregateId !== 'string' ||
    aggregateId.length === 0 ||
    aggregateId.trim() !== aggregateId
  ) {
    throw new TypeError('Question domain event aggregateId is invalid.');
  }

  if (
    !(occurredAt instanceof Date) ||
    !Number.isFinite(occurredAt.getTime())
  ) {
    throw new TypeError('Question domain event occurredAt is invalid.');
  }

  return Object.freeze({
    eventId: randomUUID(),
    eventName,
    eventVersion: QUESTION_DOMAIN_EVENT_VERSION,
    aggregateType: 'Question',
    aggregateId,
    occurredAt: new Date(occurredAt.getTime()),
    payload: Object.freeze(payload),
  });
}

export function createQuestionCreatedEvent(
  questionId: QuestionId,
  versionId: QuestionVersionId,
  versionNumber: QuestionVersionNumber,
  ownership: QuestionOwnership,
  occurredAt: Date,
): QuestionCreatedEvent {
  return createEnvelope(
    'QuestionCreated',
    questionId.value,
    {
      questionId: questionId.value,
      questionVersionId: versionId.value,
      versionNumber: versionNumber.value,
      tenantId: ownership.tenantId,
      createdByPrincipalId: ownership.createdByPrincipalId,
    },
    occurredAt,
  );
}

export function createQuestionRevisedEvent(
  questionId: QuestionId,
  versionId: QuestionVersionId,
  versionNumber: QuestionVersionNumber,
  previousVersionId: QuestionVersionId,
  ownership: QuestionOwnership,
  actorPrincipalId: string,
  occurredAt: Date,
): QuestionRevisedEvent {
  assertActor(actorPrincipalId);

  return createEnvelope(
    'QuestionRevised',
    questionId.value,
    {
      questionId: questionId.value,
      questionVersionId: versionId.value,
      versionNumber: versionNumber.value,
      previousVersionId: previousVersionId.value,
      tenantId: ownership.tenantId,
      actorPrincipalId,
    },
    occurredAt,
  );
}

export function createQuestionRestoredEvent(
  questionId: QuestionId,
  versionId: QuestionVersionId,
  versionNumber: QuestionVersionNumber,
  previousVersionId: QuestionVersionId,
  restoredFromVersionId: QuestionVersionId,
  ownership: QuestionOwnership,
  actorPrincipalId: string,
  occurredAt: Date,
): QuestionRestoredEvent {
  assertActor(actorPrincipalId);

  return createEnvelope(
    'QuestionRestored',
    questionId.value,
    {
      questionId: questionId.value,
      questionVersionId: versionId.value,
      versionNumber: versionNumber.value,
      previousVersionId: previousVersionId.value,
      restoredFromVersionId: restoredFromVersionId.value,
      tenantId: ownership.tenantId,
      actorPrincipalId,
    },
    occurredAt,
  );
}

function assertActor(value: string): void {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.trim() !== value
  ) {
    throw new TypeError(
      'Question domain event actorPrincipalId is invalid.',
    );
  }
}
