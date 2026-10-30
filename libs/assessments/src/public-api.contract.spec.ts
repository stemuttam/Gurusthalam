import { describe, expect, it } from 'vitest';

import * as AssessmentPublicApi from './index.js';

import type {
  AssessmentArchivedPayload,
  AssessmentCreatedPayload,
  AssessmentDomainEvent,
  AssessmentDomainEventEnvelope,
  AssessmentDomainEventMetadata,
  AssessmentDomainEventPayloadMap,
  AssessmentDomainEventType as AssessmentDomainEventTypeValue,
  AssessmentEventLifecycleStatus,
  AssessmentPublishedPayload,
  AssessmentPrimitives,
  AssessmentProps,
  AssessmentSnapshot,
  AssessmentStatus as AssessmentStatusValue,
  AssessmentValidationIssue,
  CreateAssessmentDomainEventInput,
} from './index.js';

describe('Assessment public API contract', () => {
  describe('aggregate exports', () => {
    it('exports the Assessment aggregate', () => {
      expect(AssessmentPublicApi.Assessment).toBeDefined();
      expect(typeof AssessmentPublicApi.Assessment.create).toBe('function');
      expect(typeof AssessmentPublicApi.Assessment.rehydrate).toBe('function');
      expect(typeof AssessmentPublicApi.Assessment.rehydrateFromSnapshot).toBe(
        'function',
      );
    });

    it('exports Assessment identity', () => {
      expect(AssessmentPublicApi.AssessmentId).toBeDefined();

      const id = AssessmentPublicApi.AssessmentId.from(
        'public-api-assessment-001',
      );

      expect(id.toString()).toBe('public-api-assessment-001');
    });

    it('exports serialization-safe snapshot validation', () => {
      expect(AssessmentPublicApi.assertValidAssessmentSnapshot).toBeDefined();

      const snapshot: AssessmentSnapshot = {
        id: 'public-api-assessment-001',
        status: AssessmentPublicApi.AssessmentStatus.DRAFT,
        createdAt: '2026-01-01T10:00:00.000Z',
        updatedAt: '2026-01-01T10:00:00.000Z',
      };

      expect(() =>
        AssessmentPublicApi.assertValidAssessmentSnapshot(snapshot),
      ).not.toThrow();

      const assessment =
        AssessmentPublicApi.Assessment.rehydrateFromSnapshot(snapshot);

      expect(assessment.toSnapshot()).toEqual(snapshot);
    });
  });

  describe('lifecycle exports', () => {
    it('exports lifecycle status values and helpers', () => {
      expect(AssessmentPublicApi.AssessmentStatus).toEqual({
        DRAFT: 'DRAFT',
        PUBLISHED: 'PUBLISHED',
        ARCHIVED: 'ARCHIVED',
      });

      expect(AssessmentPublicApi.ASSESSMENT_STATUSES).toEqual([
        'DRAFT',
        'PUBLISHED',
        'ARCHIVED',
      ]);

      expect(AssessmentPublicApi.isAssessmentStatus('DRAFT')).toBe(true);
      expect(AssessmentPublicApi.isAssessmentStatus('INVALID')).toBe(false);

      expect(
        AssessmentPublicApi.canTransitionAssessmentLifecycle(
          AssessmentPublicApi.AssessmentStatus.DRAFT,
          AssessmentPublicApi.AssessmentStatus.PUBLISHED,
        ),
      ).toBe(true);

      expect(
        AssessmentPublicApi.getAllowedAssessmentLifecycleTransitions(
          AssessmentPublicApi.AssessmentStatus.DRAFT,
        ),
      ).toEqual([AssessmentPublicApi.AssessmentStatus.PUBLISHED]);

      expect(
        AssessmentPublicApi.isTerminalAssessmentLifecycleStatus(
          AssessmentPublicApi.AssessmentStatus.ARCHIVED,
        ),
      ).toBe(true);

      expect(
        AssessmentPublicApi.ASSESSMENT_LIFECYCLE_TRANSITIONS,
      ).toBeDefined();
    });

    it('allows lifecycle progression through the public aggregate', () => {
      const assessment = AssessmentPublicApi.Assessment.create();

      assessment.publish();

      expect(assessment.status).toBe(
        AssessmentPublicApi.AssessmentStatus.PUBLISHED,
      );

      assessment.archive();

      expect(assessment.status).toBe(
        AssessmentPublicApi.AssessmentStatus.ARCHIVED,
      );
    });
  });

  describe('domain error exports', () => {
    it('exports domain error classes and codes', () => {
      expect(AssessmentPublicApi.AssessmentDomainError).toBeDefined();
      expect(AssessmentPublicApi.AssessmentValidationError).toBeDefined();
      expect(
        AssessmentPublicApi.InvalidAssessmentStateTransitionError,
      ).toBeDefined();

      expect(AssessmentPublicApi.AssessmentDomainErrorCode).toEqual({
        VALIDATION_ERROR: 'ASSESSMENT_VALIDATION_ERROR',
        INVALID_STATE_TRANSITION: 'ASSESSMENT_INVALID_STATE_TRANSITION',
      });
    });
  });

  describe('domain event exports', () => {
    it('exports supported event types', () => {
      expect(AssessmentPublicApi.AssessmentDomainEventType).toEqual({
        CREATED: 'assessments.assessment.created',
        PUBLISHED: 'assessments.assessment.published',
        ARCHIVED: 'assessments.assessment.archived',
      });
    });

    it('exports the canonical event factory', () => {
      expect(AssessmentPublicApi.createAssessmentDomainEvent).toBeDefined();

      expect(typeof AssessmentPublicApi.createAssessmentDomainEvent).toBe(
        'function',
      );
    });

    it('creates an event through the public entry point', () => {
      const assessment = AssessmentPublicApi.Assessment.create();

      const event = AssessmentPublicApi.createAssessmentDomainEvent({
        eventType: AssessmentPublicApi.AssessmentDomainEventType.CREATED,
        aggregateId: assessment.id.toString(),
        correlationId: 'public-api-correlation-001',
        payload: {
          assessmentId: assessment.id.toString(),
          status: AssessmentPublicApi.AssessmentStatus.DRAFT,
        },
      });

      expect(event.eventType).toBe(
        AssessmentPublicApi.AssessmentDomainEventType.CREATED,
      );

      expect(event.aggregateId).toBe(assessment.id.toString());
      expect(event.aggregateType).toBe('Assessment');
      expect(event.correlationId).toBe('public-api-correlation-001');
    });
  });

  describe('public type contract', () => {
    it('keeps all intended public types available at compile time', () => {
      const snapshot: AssessmentSnapshot = {
        id: 'assessment-type-contract-001',
        status: 'DRAFT',
        createdAt: '2026-01-01T10:00:00.000Z',
        updatedAt: '2026-01-01T10:00:00.000Z',
      };

      const assessment =
        AssessmentPublicApi.Assessment.rehydrateFromSnapshot(snapshot);

      const props: AssessmentProps = assessment.toPrimitives();

      const primitives: AssessmentPrimitives = assessment.toPrimitives();

      const status: AssessmentStatusValue = assessment.status;

      const validationIssue: AssessmentValidationIssue = {
        field: 'status',
        message: 'Assessment status is invalid.',
      };

      const createdPayload: AssessmentCreatedPayload = {
        assessmentId: assessment.id.toString(),
        status: AssessmentPublicApi.AssessmentStatus.DRAFT,
      };

      const publishedPayload: AssessmentPublishedPayload = {
        assessmentId: assessment.id.toString(),
        previousStatus: AssessmentPublicApi.AssessmentStatus.DRAFT,
        currentStatus: AssessmentPublicApi.AssessmentStatus.PUBLISHED,
      };

      const archivedPayload: AssessmentArchivedPayload = {
        assessmentId: assessment.id.toString(),
        previousStatus: AssessmentPublicApi.AssessmentStatus.PUBLISHED,
        currentStatus: AssessmentPublicApi.AssessmentStatus.ARCHIVED,
      };

      const payloadMap: AssessmentDomainEventPayloadMap = {
        [AssessmentPublicApi.AssessmentDomainEventType.CREATED]: createdPayload,
        [AssessmentPublicApi.AssessmentDomainEventType.PUBLISHED]:
          publishedPayload,
        [AssessmentPublicApi.AssessmentDomainEventType.ARCHIVED]:
          archivedPayload,
      };

      const eventMetadata: AssessmentDomainEventMetadata = {
        correlationId: 'correlation-001',
      };

      const eventEnvelope: AssessmentDomainEventEnvelope<
        typeof AssessmentPublicApi.AssessmentDomainEventType.CREATED,
        AssessmentCreatedPayload
      > = {
        eventId: 'event-001',
        eventVersion: 1,
        schemaVersion: 1,
        ...eventMetadata,
        occurredAt: '2026-01-01T10:00:00.000Z',
        eventType: AssessmentPublicApi.AssessmentDomainEventType.CREATED,
        aggregateId: assessment.id.toString(),
        aggregateType: 'Assessment',
        payload: createdPayload,
      };

      const event: AssessmentDomainEvent = eventEnvelope;

      const eventType: AssessmentDomainEventTypeValue =
        AssessmentPublicApi.AssessmentDomainEventType.CREATED;

      const lifecycleStatus: AssessmentEventLifecycleStatus =
        AssessmentPublicApi.AssessmentStatus.DRAFT;

      const input: CreateAssessmentDomainEventInput<AssessmentDomainEventTypeValue> =
        {
          eventType: AssessmentPublicApi.AssessmentDomainEventType.CREATED,
          aggregateId: assessment.id.toString(),
          correlationId: 'correlation-001',
          payload: createdPayload,
        };

      expect(props.id).toBe(assessment.id);
      expect(primitives.id).toBe(assessment.id);
      expect(status).toBe('DRAFT');
      expect(validationIssue.field).toBe('status');
      expect(payloadMap).toBeDefined();
      expect(event).toBeDefined();
      expect(eventType).toBe('assessments.assessment.created');
      expect(lifecycleStatus).toBe('DRAFT');
      expect(input.aggregateId).toBe(assessment.id.toString());
      expect(eventEnvelope.eventId).toBe('event-001');
      expect(eventEnvelope.occurredAt).toBe('2026-01-01T10:00:00.000Z');
      expect(eventEnvelope.aggregateType).toBe('Assessment');
    });
  });
});
