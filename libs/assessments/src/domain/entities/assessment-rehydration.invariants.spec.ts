import { describe, expect, it } from 'vitest';

import { Assessment } from './assessment.js';

import { AssessmentStatus } from '../enums/assessment-status.js';

import { AssessmentValidationError } from '../errors/index.js';

import { AssessmentId } from '../identifiers/assessment-id.js';

const createAssessment = () => Assessment.create();

describe('Assessment rehydration invariants', () => {
  describe('identity preservation', () => {
    it('preserves aggregate identity during rehydration', () => {
      const assessment = createAssessment();

      const rehydrated = Assessment.rehydrate(assessment.toPrimitives());

      expect(rehydrated.id.toString()).toBe(assessment.id.toString());
      expect(rehydrated.id.equals(assessment.id)).toBe(true);
    });

    it('does not generate a new identity during rehydration', () => {
      const assessment = createAssessment();
      const originalId = assessment.id.toString();

      const rehydrated = Assessment.rehydrate(assessment.toPrimitives());

      expect(rehydrated.id.toString()).toBe(originalId);
    });

    it('preserves an existing opaque Assessment identifier', () => {
      const originalId = AssessmentId.from('legacy-assessment-2026-001');

      const assessment = Assessment.rehydrate({
        id: originalId,
        status: AssessmentStatus.DRAFT,
        createdAt: new Date('2026-01-01T10:00:00.000Z'),
        updatedAt: new Date('2026-01-01T10:00:00.000Z'),
      });

      expect(assessment.id.toString()).toBe('legacy-assessment-2026-001');
    });
  });

  describe('lifecycle preservation', () => {
    it('preserves DRAFT state', () => {
      const assessment = createAssessment();

      const rehydrated = Assessment.rehydrate(assessment.toPrimitives());

      expect(rehydrated.status).toBe(AssessmentStatus.DRAFT);
    });

    it('preserves PUBLISHED state', () => {
      const assessment = createAssessment();

      assessment.publish();

      const rehydrated = Assessment.rehydrate(assessment.toPrimitives());

      expect(rehydrated.status).toBe(AssessmentStatus.PUBLISHED);
    });

    it('preserves ARCHIVED state', () => {
      const assessment = createAssessment();

      assessment.publish();
      assessment.archive();

      const rehydrated = Assessment.rehydrate(assessment.toPrimitives());

      expect(rehydrated.status).toBe(AssessmentStatus.ARCHIVED);
    });

    it('allows valid lifecycle progression after rehydration from DRAFT', () => {
      const assessment = createAssessment();

      const rehydrated = Assessment.rehydrate(assessment.toPrimitives());

      rehydrated.publish();

      expect(rehydrated.status).toBe(AssessmentStatus.PUBLISHED);
    });

    it('allows valid lifecycle progression after rehydration from PUBLISHED', () => {
      const assessment = createAssessment();

      assessment.publish();

      const rehydrated = Assessment.rehydrate(assessment.toPrimitives());

      rehydrated.archive();

      expect(rehydrated.status).toBe(AssessmentStatus.ARCHIVED);
    });
  });

  describe('timestamp preservation', () => {
    it('preserves createdAt exactly', () => {
      const assessment = createAssessment();

      const originalCreatedAt = assessment.createdAt.getTime();

      const rehydrated = Assessment.rehydrate(assessment.toPrimitives());

      expect(rehydrated.createdAt.getTime()).toBe(originalCreatedAt);
    });

    it('preserves updatedAt exactly', () => {
      const assessment = createAssessment();

      assessment.publish();

      const originalUpdatedAt = assessment.updatedAt.getTime();

      const rehydrated = Assessment.rehydrate(assessment.toPrimitives());

      expect(rehydrated.updatedAt.getTime()).toBe(originalUpdatedAt);
    });

    it('preserves timestamp ordering', () => {
      const assessment = createAssessment();

      assessment.publish();

      const rehydrated = Assessment.rehydrate(assessment.toPrimitives());

      expect(rehydrated.createdAt.getTime()).toBeLessThanOrEqual(
        rehydrated.updatedAt.getTime(),
      );
    });
  });

  describe('invalid persisted state', () => {
    const validProps = () => ({
      id: AssessmentId.from('assessment-001'),
      status: AssessmentStatus.DRAFT,
      createdAt: new Date('2026-01-01T10:00:00.000Z'),
      updatedAt: new Date('2026-01-01T10:00:00.000Z'),
    });

    it('rejects an invalid Assessment identifier', () => {
      const props = validProps();

      expect(() =>
        Assessment.rehydrate({
          ...props,
          id: null as unknown as AssessmentId,
        }),
      ).toThrow(AssessmentValidationError);
    });

    it('rejects an unsupported lifecycle status', () => {
      const props = validProps();

      expect(() =>
        Assessment.rehydrate({
          ...props,
          status: 'INVALID' as AssessmentStatus,
        }),
      ).toThrow(AssessmentValidationError);
    });

    it('rejects an invalid createdAt timestamp', () => {
      const props = validProps();

      expect(() =>
        Assessment.rehydrate({
          ...props,
          createdAt: new Date(Number.NaN),
        }),
      ).toThrow(AssessmentValidationError);
    });

    it('rejects an invalid updatedAt timestamp', () => {
      const props = validProps();

      expect(() =>
        Assessment.rehydrate({
          ...props,
          updatedAt: new Date(Number.NaN),
        }),
      ).toThrow(AssessmentValidationError);
    });

    it('rejects updatedAt earlier than createdAt', () => {
      const props = validProps();

      expect(() =>
        Assessment.rehydrate({
          ...props,
          createdAt: new Date('2026-01-02T10:00:00.000Z'),
          updatedAt: new Date('2026-01-01T10:00:00.000Z'),
        }),
      ).toThrow(AssessmentValidationError);
    });

    it('reports all invalid persisted fields together', () => {
      expect(() =>
        Assessment.rehydrate({
          id: null as unknown as AssessmentId,
          status: 'INVALID' as AssessmentStatus,
          createdAt: new Date(Number.NaN),
          updatedAt: new Date(Number.NaN),
        }),
      ).toThrow(
        expect.objectContaining({
          issues: expect.arrayContaining([
            expect.objectContaining({ field: 'id' }),
            expect.objectContaining({ field: 'status' }),
            expect.objectContaining({ field: 'createdAt' }),
            expect.objectContaining({ field: 'updatedAt' }),
          ]),
        }),
      );
    });
  });

  describe('defensive-copy invariants', () => {
    it('does not expose the input createdAt Date instance', () => {
      const assessment = createAssessment();
      const primitives = assessment.toPrimitives();
      const originalCreatedAt = primitives.createdAt.getTime();

      const rehydrated = Assessment.rehydrate(primitives);

      primitives.createdAt.setTime(0);

      expect(rehydrated.createdAt.getTime()).toBe(originalCreatedAt);
    });

    it('does not expose the input updatedAt Date instance', () => {
      const assessment = createAssessment();
      const primitives = assessment.toPrimitives();
      const originalUpdatedAt = primitives.updatedAt.getTime();

      const rehydrated = Assessment.rehydrate(primitives);

      primitives.updatedAt.setTime(0);

      expect(rehydrated.updatedAt.getTime()).toBe(originalUpdatedAt);
    });

    it('returns a defensive createdAt Date', () => {
      const assessment = createAssessment();
      const createdAt = assessment.createdAt;
      const originalValue = createdAt.getTime();

      createdAt.setTime(0);

      expect(assessment.createdAt.getTime()).toBe(originalValue);
    });

    it('returns a defensive updatedAt Date', () => {
      const assessment = createAssessment();
      const updatedAt = assessment.updatedAt;
      const originalValue = updatedAt.getTime();

      updatedAt.setTime(0);

      expect(assessment.updatedAt.getTime()).toBe(originalValue);
    });

    it('does not mutate serialized state when the aggregate changes', () => {
      const assessment = createAssessment();
      const primitives = assessment.toPrimitives();

      const originalStatus = primitives.status;
      const originalUpdatedAt = primitives.updatedAt.getTime();

      assessment.publish();

      expect(primitives.status).toBe(originalStatus);
      expect(primitives.updatedAt.getTime()).toBe(originalUpdatedAt);
    });
  });

  describe('round-trip invariants', () => {
    it('preserves complete DRAFT state through a round trip', () => {
      const assessment = createAssessment();

      const original = assessment.toPrimitives();
      const roundTrip = Assessment.rehydrate(original).toPrimitives();

      expect(roundTrip).toEqual(original);
    });

    it('preserves complete PUBLISHED state through a round trip', () => {
      const assessment = createAssessment();

      assessment.publish();

      const original = assessment.toPrimitives();
      const roundTrip = Assessment.rehydrate(original).toPrimitives();

      expect(roundTrip).toEqual(original);
    });

    it('preserves complete ARCHIVED state through a round trip', () => {
      const assessment = createAssessment();

      assessment.publish();
      assessment.archive();

      const original = assessment.toPrimitives();
      const roundTrip = Assessment.rehydrate(original).toPrimitives();

      expect(roundTrip).toEqual(original);
    });

    it('remains stable through repeated rehydration', () => {
      const assessment = createAssessment();

      assessment.publish();
      assessment.archive();

      const first = assessment.toPrimitives();
      const second = Assessment.rehydrate(first).toPrimitives();
      const third = Assessment.rehydrate(second).toPrimitives();

      expect(second).toEqual(first);
      expect(third).toEqual(second);
      expect(third).toEqual(first);
    });
  });

  describe('post-rehydration isolation', () => {
    it('does not mutate the original aggregate when the rehydrated instance changes', () => {
      const original = createAssessment();

      const rehydrated = Assessment.rehydrate(original.toPrimitives());

      rehydrated.publish();

      expect(original.status).toBe(AssessmentStatus.DRAFT);
      expect(rehydrated.status).toBe(AssessmentStatus.PUBLISHED);
    });
  });
});
