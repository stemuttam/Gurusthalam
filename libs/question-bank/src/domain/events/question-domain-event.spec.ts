import { describe, expect, it } from 'vitest';

import { QuestionId } from '../identifiers/question-id.js';
import { QuestionVersionId } from '../identifiers/question-version-id.js';
import { QuestionVersionNumber } from '../identifiers/question-version-number.js';
import { QuestionOwnership } from '../ownership/question-ownership.js';

import {
  createQuestionCreatedEvent,
  createQuestionRevisedEvent,
  createQuestionRestoredEvent,
} from './question-domain-event.js';

describe('Question domain events', () => {
  const questionId = QuestionId.from('question-001');
  const version1 = QuestionVersionId.from('question-version-001');
  const version2 = QuestionVersionId.from('question-version-002');
  const version3 = QuestionVersionId.from('question-version-003');
  const ownership = QuestionOwnership.create(
    'tenant-001',
    'principal-001',
  );
  const occurredAt = new Date('2026-11-07T10:00:00.000Z');

  it('creates a QuestionCreated event without content or answer keys', () => {
    const event = createQuestionCreatedEvent(
      questionId,
      version1,
      QuestionVersionNumber.initial(),
      ownership,
      occurredAt,
    );

    expect(event.eventName).toBe('QuestionCreated');
    expect(event.aggregateType).toBe('Question');
    expect(event.aggregateId).toBe(questionId.value);
    expect(event.payload).toEqual({
      questionId: questionId.value,
      questionVersionId: version1.value,
      versionNumber: 1,
      tenantId: 'tenant-001',
      createdByPrincipalId: 'principal-001',
    });
    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.payload)).toBe(true);
    expect('answerKey' in event.payload).toBe(false);
    expect('content' in event.payload).toBe(false);
  });

  it('creates a revision event with its immediate predecessor', () => {
    const event = createQuestionRevisedEvent(
      questionId,
      version2,
      QuestionVersionNumber.from(2),
      version1,
      ownership,
      'principal-002',
      occurredAt,
    );

    expect(event.eventName).toBe('QuestionRevised');
    expect(event.payload.previousVersionId).toBe(version1.value);
    expect(event.payload.versionNumber).toBe(2);
    expect(event.payload.actorPrincipalId).toBe('principal-002');
  });

  it('creates a restoration event with separate predecessor and source', () => {
    const event = createQuestionRestoredEvent(
      questionId,
      version3,
      QuestionVersionNumber.from(3),
      version2,
      version1,
      ownership,
      'principal-002',
      occurredAt,
    );

    expect(event.eventName).toBe('QuestionRestored');
    expect(event.payload.previousVersionId).toBe(version2.value);
    expect(event.payload.restoredFromVersionId).toBe(version1.value);
    expect(event.payload.previousVersionId).not.toBe(
      event.payload.restoredFromVersionId,
    );
  });

  it('rejects an invalid event timestamp', () => {
    expect(() =>
      createQuestionCreatedEvent(
        questionId,
        version1,
        QuestionVersionNumber.initial(),
        ownership,
        new Date(Number.NaN),
      ),
    ).toThrow('Question domain event occurredAt is invalid.');
  });

  it('rejects an invalid actor identifier', () => {
    expect(() =>
      createQuestionRevisedEvent(
        questionId,
        version2,
        QuestionVersionNumber.from(2),
        version1,
        ownership,
        ' ',
        occurredAt,
      ),
    ).toThrow('Question domain event actorPrincipalId is invalid.');
  });
});