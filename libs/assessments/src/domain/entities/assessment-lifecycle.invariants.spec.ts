import { describe, expect, it } from 'vitest';

import { Assessment } from './assessment.js';

import { AssessmentStatus } from '../enums/assessment-status.js';

import {
  canTransitionAssessmentLifecycle,
  getAllowedAssessmentLifecycleTransitions,
  isTerminalAssessmentLifecycleStatus,
} from '../lifecycle/assessment-lifecycle.policy.js';

import { InvalidAssessmentStateTransitionError } from '../errors/index.js';

describe('Assessment lifecycle invariants', () => {
  describe('initial state', () => {
    it('creates every new Assessment in DRAFT', () => {
      const assessment = Assessment.create();

      expect(assessment.status).toBe(AssessmentStatus.DRAFT);
    });

    it('creates a unique identity for each Assessment', () => {
      const first = Assessment.create();
      const second = Assessment.create();

      expect(first.id.equals(second.id)).toBe(false);
    });

    it('initializes valid creation and update timestamps', () => {
      const assessment = Assessment.create();

      expect(assessment.createdAt).toBeInstanceOf(Date);
      expect(assessment.updatedAt).toBeInstanceOf(Date);

      expect(assessment.createdAt.getTime()).not.toBeNaN();
      expect(assessment.updatedAt.getTime()).not.toBeNaN();

      expect(assessment.updatedAt.getTime()).toBeGreaterThanOrEqual(
        assessment.createdAt.getTime(),
      );
    });
  });

  describe('lifecycle policy', () => {
    it('allows DRAFT to PUBLISHED', () => {
      expect(
        canTransitionAssessmentLifecycle(
          AssessmentStatus.DRAFT,
          AssessmentStatus.PUBLISHED,
        ),
      ).toBe(true);
    });

    it('allows PUBLISHED to ARCHIVED', () => {
      expect(
        canTransitionAssessmentLifecycle(
          AssessmentStatus.PUBLISHED,
          AssessmentStatus.ARCHIVED,
        ),
      ).toBe(true);
    });

    it('rejects DRAFT to ARCHIVED', () => {
      expect(
        canTransitionAssessmentLifecycle(
          AssessmentStatus.DRAFT,
          AssessmentStatus.ARCHIVED,
        ),
      ).toBe(false);
    });

    it('rejects PUBLISHED to DRAFT', () => {
      expect(
        canTransitionAssessmentLifecycle(
          AssessmentStatus.PUBLISHED,
          AssessmentStatus.DRAFT,
        ),
      ).toBe(false);
    });

    it('rejects repeated transitions to the same state', () => {
      expect(
        canTransitionAssessmentLifecycle(
          AssessmentStatus.DRAFT,
          AssessmentStatus.DRAFT,
        ),
      ).toBe(false);

      expect(
        canTransitionAssessmentLifecycle(
          AssessmentStatus.PUBLISHED,
          AssessmentStatus.PUBLISHED,
        ),
      ).toBe(false);

      expect(
        canTransitionAssessmentLifecycle(
          AssessmentStatus.ARCHIVED,
          AssessmentStatus.ARCHIVED,
        ),
      ).toBe(false);
    });

    it('exposes only the permitted next states', () => {
      expect(
        getAllowedAssessmentLifecycleTransitions(AssessmentStatus.DRAFT),
      ).toEqual([AssessmentStatus.PUBLISHED]);

      expect(
        getAllowedAssessmentLifecycleTransitions(AssessmentStatus.PUBLISHED),
      ).toEqual([AssessmentStatus.ARCHIVED]);

      expect(
        getAllowedAssessmentLifecycleTransitions(AssessmentStatus.ARCHIVED),
      ).toEqual([]);
    });

    it('does not expose mutable lifecycle policy arrays', () => {
      const transitions = getAllowedAssessmentLifecycleTransitions(
        AssessmentStatus.DRAFT,
      );

      expect(() => {
        (transitions as AssessmentStatus[]).push(AssessmentStatus.ARCHIVED);
      }).not.toThrow();

      expect(
        getAllowedAssessmentLifecycleTransitions(AssessmentStatus.DRAFT),
      ).toEqual([AssessmentStatus.PUBLISHED]);
    });

    it('identifies ARCHIVED as the terminal state', () => {
      expect(
        isTerminalAssessmentLifecycleStatus(AssessmentStatus.ARCHIVED),
      ).toBe(true);

      expect(isTerminalAssessmentLifecycleStatus(AssessmentStatus.DRAFT)).toBe(
        false,
      );

      expect(
        isTerminalAssessmentLifecycleStatus(AssessmentStatus.PUBLISHED),
      ).toBe(false);
    });
  });

  describe('valid lifecycle transitions', () => {
    it('allows DRAFT to PUBLISHED', () => {
      const assessment = Assessment.create();

      assessment.publish();

      expect(assessment.status).toBe(AssessmentStatus.PUBLISHED);
    });

    it('allows PUBLISHED to ARCHIVED', () => {
      const assessment = Assessment.create();

      assessment.publish();
      assessment.archive();

      expect(assessment.status).toBe(AssessmentStatus.ARCHIVED);
    });

    it('preserves Assessment identity through every valid transition', () => {
      const assessment = Assessment.create();
      const originalId = assessment.id;

      assessment.publish();

      expect(assessment.id).toBe(originalId);

      assessment.archive();

      expect(assessment.id).toBe(originalId);
    });

    it('does not modify creation timestamp during lifecycle transitions', () => {
      const assessment = Assessment.create();
      const originalCreatedAt = assessment.createdAt.getTime();

      assessment.publish();
      assessment.archive();

      expect(assessment.createdAt.getTime()).toBe(originalCreatedAt);
    });

    it('does not move updatedAt backwards during transitions', () => {
      const assessment = Assessment.create();
      const initialUpdatedAt = assessment.updatedAt.getTime();

      assessment.publish();

      expect(assessment.updatedAt.getTime()).toBeGreaterThanOrEqual(
        initialUpdatedAt,
      );

      const publishedUpdatedAt = assessment.updatedAt.getTime();

      assessment.archive();

      expect(assessment.updatedAt.getTime()).toBeGreaterThanOrEqual(
        publishedUpdatedAt,
      );
    });
  });

  describe('invalid lifecycle transitions', () => {
    it('rejects publishing an already published Assessment', () => {
      const assessment = Assessment.create();

      assessment.publish();

      expect(() => assessment.publish()).toThrow(
        InvalidAssessmentStateTransitionError,
      );

      expect(assessment.status).toBe(AssessmentStatus.PUBLISHED);
    });

    it('rejects archiving a DRAFT Assessment', () => {
      const assessment = Assessment.create();

      expect(() => assessment.archive()).toThrow(
        InvalidAssessmentStateTransitionError,
      );

      expect(assessment.status).toBe(AssessmentStatus.DRAFT);
    });

    it('rejects archiving an already archived Assessment', () => {
      const assessment = Assessment.create();

      assessment.publish();
      assessment.archive();

      expect(() => assessment.archive()).toThrow(
        InvalidAssessmentStateTransitionError,
      );

      expect(assessment.status).toBe(AssessmentStatus.ARCHIVED);
    });

    it('rejects publishing an archived Assessment', () => {
      const assessment = Assessment.create();

      assessment.publish();
      assessment.archive();

      expect(() => assessment.publish()).toThrow(
        InvalidAssessmentStateTransitionError,
      );

      expect(assessment.status).toBe(AssessmentStatus.ARCHIVED);
    });

    it('does not change updatedAt after a rejected transition', () => {
      const assessment = Assessment.create();
      const originalUpdatedAt = assessment.updatedAt.getTime();

      expect(() => assessment.archive()).toThrow(
        InvalidAssessmentStateTransitionError,
      );

      expect(assessment.updatedAt.getTime()).toBe(originalUpdatedAt);
    });

    it('reports the invalid lifecycle field in the domain error', () => {
      const assessment = Assessment.create();

      try {
        assessment.archive();

        throw new Error('Expected lifecycle transition to fail.');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidAssessmentStateTransitionError);

        if (!(error instanceof InvalidAssessmentStateTransitionError)) {
          throw error;
        }

        expect(error.issues).toEqual([
          {
            field: 'status',
            message: 'Transition from DRAFT to ARCHIVED is not permitted.',
          },
        ]);
      }
    });
  });

  describe('terminal-state invariants', () => {
    it('keeps ARCHIVED terminal after every rejected lifecycle operation', () => {
      const assessment = Assessment.create();

      assessment.publish();
      assessment.archive();

      expect(() => assessment.publish()).toThrow(
        InvalidAssessmentStateTransitionError,
      );

      expect(() => assessment.archive()).toThrow(
        InvalidAssessmentStateTransitionError,
      );

      expect(assessment.status).toBe(AssessmentStatus.ARCHIVED);
    });
  });

  describe('aggregate isolation', () => {
    it('does not allow one Assessment mutation to affect another', () => {
      const first = Assessment.create();
      const second = Assessment.create();

      first.publish();

      expect(first.status).toBe(AssessmentStatus.PUBLISHED);
      expect(second.status).toBe(AssessmentStatus.DRAFT);
    });

    it('keeps independent lifecycle state for multiple aggregates', () => {
      const first = Assessment.create();
      const second = Assessment.create();

      first.publish();
      second.publish();
      second.archive();

      expect(first.status).toBe(AssessmentStatus.PUBLISHED);
      expect(second.status).toBe(AssessmentStatus.ARCHIVED);
    });
  });
});
