import { describe, expect, it } from 'vitest';

import { AssessmentStatus } from '../enums/assessment-status.js';
import { AssessmentValidationError } from '../errors/index.js';

import { AssessmentDomainEventType } from './assessment-domain-event.js';
import { createAssessmentDomainEvent } from './assessment-domain-event.validation.js';

const assessmentId = 'assessment-123';
const correlationId = 'correlation-456';

/**
 * Simulates untrusted runtime input.
 *
 * This helper deliberately bypasses compile-time input validation so
 * that the factory's runtime validation can be tested independently.
 *
 * Production callers should use the strongly typed factory directly.
 */
function createEventWithUntrustedInput(input: unknown): unknown {
  return Reflect.apply(createAssessmentDomainEvent, undefined, [input]);
}

describe('createAssessmentDomainEvent', () => {
  it('creates an AssessmentCreated event with the canonical envelope', () => {
    const event = createAssessmentDomainEvent({
      eventType: AssessmentDomainEventType.CREATED,
      aggregateId: assessmentId,
      correlationId,
      occurredAt: new Date('2026-01-01T10:00:00.000Z'),
      payload: {
        assessmentId,
        status: AssessmentStatus.DRAFT,
      },
    });

    expect(event).toMatchObject({
      eventType: AssessmentDomainEventType.CREATED,
      eventVersion: 1,
      aggregateId: assessmentId,
      aggregateType: 'Assessment',
      correlationId,
      occurredAt: '2026-01-01T10:00:00.000Z',
      schemaVersion: 1,
      payload: {
        assessmentId,
        status: AssessmentStatus.DRAFT,
      },
    });

    expect(event.eventId).toEqual(expect.any(String));
  });

  it('creates an AssessmentPublished event with valid lifecycle facts', () => {
    const event = createAssessmentDomainEvent({
      eventType: AssessmentDomainEventType.PUBLISHED,
      aggregateId: assessmentId,
      correlationId,
      payload: {
        assessmentId,
        previousStatus: AssessmentStatus.DRAFT,
        currentStatus: AssessmentStatus.PUBLISHED,
      },
    });

    expect(event.eventType).toBe(AssessmentDomainEventType.PUBLISHED);

    expect(event.payload).toEqual({
      assessmentId,
      previousStatus: AssessmentStatus.DRAFT,
      currentStatus: AssessmentStatus.PUBLISHED,
    });
  });

  it('creates an AssessmentArchived event with valid lifecycle facts', () => {
    const event = createAssessmentDomainEvent({
      eventType: AssessmentDomainEventType.ARCHIVED,
      aggregateId: assessmentId,
      correlationId,
      payload: {
        assessmentId,
        previousStatus: AssessmentStatus.PUBLISHED,
        currentStatus: AssessmentStatus.ARCHIVED,
      },
    });

    expect(event.eventType).toBe(AssessmentDomainEventType.ARCHIVED);

    expect(event.payload).toEqual({
      assessmentId,
      previousStatus: AssessmentStatus.PUBLISHED,
      currentStatus: AssessmentStatus.ARCHIVED,
    });
  });

  it('generates a distinct event ID for each event', () => {
    const first = createAssessmentDomainEvent({
      eventType: AssessmentDomainEventType.CREATED,
      aggregateId: assessmentId,
      correlationId,
      payload: {
        assessmentId,
        status: AssessmentStatus.DRAFT,
      },
    });

    const second = createAssessmentDomainEvent({
      eventType: AssessmentDomainEventType.CREATED,
      aggregateId: assessmentId,
      correlationId,
      payload: {
        assessmentId,
        status: AssessmentStatus.DRAFT,
      },
    });

    expect(first.eventId).not.toBe(second.eventId);
  });

  it('preserves optional tenant, actor and causation metadata', () => {
    const event = createAssessmentDomainEvent({
      eventType: AssessmentDomainEventType.CREATED,
      aggregateId: assessmentId,
      correlationId,
      tenantId: 'tenant-1',
      actorId: 'actor-1',
      causationId: 'command-1',
      payload: {
        assessmentId,
        status: AssessmentStatus.DRAFT,
      },
    });

    expect(event).toMatchObject({
      tenantId: 'tenant-1',
      actorId: 'actor-1',
      causationId: 'command-1',
    });
  });

  it('omits optional metadata when it is not supplied', () => {
    const event = createAssessmentDomainEvent({
      eventType: AssessmentDomainEventType.CREATED,
      aggregateId: assessmentId,
      correlationId,
      payload: {
        assessmentId,
        status: AssessmentStatus.DRAFT,
      },
    });

    expect(event).not.toHaveProperty('tenantId');
    expect(event).not.toHaveProperty('actorId');
    expect(event).not.toHaveProperty('causationId');
  });

  it('normalizes a supplied ISO-compatible timestamp to canonical ISO format', () => {
    const event = createAssessmentDomainEvent({
      eventType: AssessmentDomainEventType.CREATED,
      aggregateId: assessmentId,
      correlationId,
      occurredAt: '2026-01-01T11:00:00+01:00',
      payload: {
        assessmentId,
        status: AssessmentStatus.DRAFT,
      },
    });

    expect(event.occurredAt).toBe('2026-01-01T10:00:00.000Z');
  });

  it('rejects a missing correlation ID', () => {
    expect(() =>
      createEventWithUntrustedInput({
        eventType: AssessmentDomainEventType.CREATED,
        aggregateId: assessmentId,
        correlationId: ' ',
        payload: {
          assessmentId,
          status: AssessmentStatus.DRAFT,
        },
      }),
    ).toThrow(AssessmentValidationError);
  });

  it('rejects an invalid aggregate ID', () => {
    expect(() =>
      createEventWithUntrustedInput({
        eventType: AssessmentDomainEventType.CREATED,
        aggregateId: ' ',
        correlationId,
        payload: {
          assessmentId,
          status: AssessmentStatus.DRAFT,
        },
      }),
    ).toThrow(AssessmentValidationError);
  });

  it('rejects a payload whose Assessment ID differs from the aggregate ID', () => {
    expect(() =>
      createEventWithUntrustedInput({
        eventType: AssessmentDomainEventType.CREATED,
        aggregateId: assessmentId,
        correlationId,
        payload: {
          assessmentId: 'another-assessment',
          status: AssessmentStatus.DRAFT,
        },
      }),
    ).toThrow(AssessmentValidationError);
  });

  it('rejects a created event with a non-DRAFT status', () => {
    expect(() =>
      createEventWithUntrustedInput({
        eventType: AssessmentDomainEventType.CREATED,
        aggregateId: assessmentId,
        correlationId,
        payload: {
          assessmentId,
          status: AssessmentStatus.PUBLISHED,
        },
      }),
    ).toThrow(AssessmentValidationError);
  });

  it('rejects a published event with an invalid previous status', () => {
    expect(() =>
      createEventWithUntrustedInput({
        eventType: AssessmentDomainEventType.PUBLISHED,
        aggregateId: assessmentId,
        correlationId,
        payload: {
          assessmentId,
          previousStatus: AssessmentStatus.ARCHIVED,
          currentStatus: AssessmentStatus.PUBLISHED,
        },
      }),
    ).toThrow(AssessmentValidationError);
  });

  it('rejects an archived event with an invalid current status', () => {
    expect(() =>
      createEventWithUntrustedInput({
        eventType: AssessmentDomainEventType.ARCHIVED,
        aggregateId: assessmentId,
        correlationId,
        payload: {
          assessmentId,
          previousStatus: AssessmentStatus.PUBLISHED,
          currentStatus: AssessmentStatus.DRAFT,
        },
      }),
    ).toThrow(AssessmentValidationError);
  });

  it('rejects an invalid occurrence timestamp', () => {
    expect(() =>
      createEventWithUntrustedInput({
        eventType: AssessmentDomainEventType.CREATED,
        aggregateId: assessmentId,
        correlationId,
        occurredAt: 'not-a-date',
        payload: {
          assessmentId,
          status: AssessmentStatus.DRAFT,
        },
      }),
    ).toThrow(AssessmentValidationError);
  });

  it('does not retain a mutable reference to the caller payload', () => {
    const payload = {
      assessmentId,
      status: AssessmentStatus.DRAFT,
    };

    const event = createAssessmentDomainEvent({
      eventType: AssessmentDomainEventType.CREATED,
      aggregateId: assessmentId,
      correlationId,
      payload,
    });

    payload.assessmentId = 'changed-after-event-creation';

    expect(event.payload.assessmentId).toBe(assessmentId);
  });

  it('freezes the event envelope and payload at runtime', () => {
    const event = createAssessmentDomainEvent({
      eventType: AssessmentDomainEventType.CREATED,
      aggregateId: assessmentId,
      correlationId,
      payload: {
        assessmentId,
        status: AssessmentStatus.DRAFT,
      },
    });

    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.payload)).toBe(true);
  });

  it('does not include specialized assessment content in the event contract', () => {
    const event = createAssessmentDomainEvent({
      eventType: AssessmentDomainEventType.CREATED,
      aggregateId: assessmentId,
      correlationId,
      payload: {
        assessmentId,
        status: AssessmentStatus.DRAFT,
      },
    });

    expect(event.payload).not.toHaveProperty('questions');
    expect(event.payload).not.toHaveProperty('answerKey');
    expect(event.payload).not.toHaveProperty('grading');
  });

  it('rejects an unsupported event type at runtime', () => {
    expect(() =>
      createEventWithUntrustedInput({
        eventType: 'assessments.assessment.deleted',
        aggregateId: assessmentId,
        correlationId,
        payload: {
          assessmentId,
        },
      }),
    ).toThrow(AssessmentValidationError);
  });
});
