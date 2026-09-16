import { describe, expect, it } from 'vitest';

import { CourseValidationError } from '../../errors/index.js';
import { AssessmentReferenceId } from '../identifiers/assessment-reference-id.js';
import { ContentItemReferenceId } from '../identifiers/content-item-reference-id.js';
import { LearningUnitId } from '../identifiers/learning-unit-id.js';
import {
  createAssessmentReference,
  rehydrateAssessmentReference,
} from './assessment-reference.js';
import {
  createContentItemReference,
  rehydrateContentItemReference,
} from './content-item-reference.js';

const learningUnitId = LearningUnitId.from('learning-unit-001');

const expectValidationIssue = (
  action: () => void,
  field: string,
  message: string,
  expectedErrorMessage?: string,
): void => {
  let error: unknown;

  try {
    action();
  } catch (caught) {
    error = caught;
  }

  expect(error).toBeInstanceOf(CourseValidationError);

  if (!(error instanceof CourseValidationError)) {
    return;
  }

  if (expectedErrorMessage !== undefined) {
    expect(error.message).toBe(expectedErrorMessage);
  }

  expect(error.issues).toContainEqual({
    field,
    message,
  });
};

describe('Course Structure references', () => {
  describe('ContentItemReference', () => {
    it('creates an immutable content reference', () => {
      const reference = createContentItemReference({
        learningUnitId,
        contentItemTargetId: 'content-item-001',
        position: 1,
      });

      expect(reference.id).toBeInstanceOf(ContentItemReferenceId);
      expect(reference.learningUnitId.equals(learningUnitId)).toBe(true);
      expect(reference.contentItemTargetId).toBe('content-item-001');
      expect(reference.position).toBe(1);
      expect(Object.isFrozen(reference)).toBe(true);
    });

    it('generates distinct structural reference identities', () => {
      const first = createContentItemReference({
        learningUnitId,
        contentItemTargetId: 'content-item-001',
        position: 1,
      });

      const second = createContentItemReference({
        learningUnitId,
        contentItemTargetId: 'content-item-002',
        position: 2,
      });

      expect(first.id.equals(second.id)).toBe(false);
    });

    it('keeps structural reference identity separate from target identity', () => {
      const first = createContentItemReference({
        learningUnitId,
        contentItemTargetId: 'content-item-001',
        position: 1,
      });

      const second = createContentItemReference({
        learningUnitId,
        contentItemTargetId: 'content-item-001',
        position: 2,
      });

      expect(first.contentItemTargetId).toBe(second.contentItemTargetId);
      expect(first.id.equals(second.id)).toBe(false);
    });

    it('supports the same target being referenced in different LearningUnits', () => {
      const first = createContentItemReference({
        learningUnitId: LearningUnitId.from('learning-unit-001'),
        contentItemTargetId: 'content-item-001',
        position: 1,
      });

      const second = createContentItemReference({
        learningUnitId: LearningUnitId.from('learning-unit-002'),
        contentItemTargetId: 'content-item-001',
        position: 1,
      });

      expect(first.contentItemTargetId).toBe(second.contentItemTargetId);
      expect(first.learningUnitId.equals(second.learningUnitId)).toBe(false);
    });

    it('rejects an empty target identifier', () => {
      expectValidationIssue(
        () =>
          createContentItemReference({
            learningUnitId,
            contentItemTargetId: '',
            position: 1,
          }),
        'contentItemTargetId',
        'Content Item target identifier must be a non-empty string.',
        'ContentItemReference target identifier is required.',
      );
    });

    it('rejects a whitespace-only target identifier', () => {
      expectValidationIssue(
        () =>
          createContentItemReference({
            learningUnitId,
            contentItemTargetId: '   ',
            position: 1,
          }),
        'contentItemTargetId',
        'Content Item target identifier must be a non-empty string.',
        'ContentItemReference target identifier is required.',
      );
    });

    it('rejects a target identifier with leading whitespace', () => {
      expectValidationIssue(
        () =>
          createContentItemReference({
            learningUnitId,
            contentItemTargetId: ' content-item-001',
            position: 1,
          }),
        'contentItemTargetId',
        'Content Item target identifier must not contain leading or trailing whitespace.',
        'ContentItemReference target identifier is invalid.',
      );
    });

    it('rejects a target identifier with trailing whitespace', () => {
      expectValidationIssue(
        () =>
          createContentItemReference({
            learningUnitId,
            contentItemTargetId: 'content-item-001 ',
            position: 1,
          }),
        'contentItemTargetId',
        'Content Item target identifier must not contain leading or trailing whitespace.',
        'ContentItemReference target identifier is invalid.',
      );
    });

    it('rejects an invalid position', () => {
      expectValidationIssue(
        () =>
          createContentItemReference({
            learningUnitId,
            contentItemTargetId: 'content-item-001',
            position: 0,
          }),
        'position',
        'Content Item reference position must be a positive integer.',
        'ContentItemReference position is invalid.',
      );
    });

    it('rejects a fractional position', () => {
      expectValidationIssue(
        () =>
          createContentItemReference({
            learningUnitId,
            contentItemTargetId: 'content-item-001',
            position: 1.5,
          }),
        'position',
        'Content Item reference position must be a positive integer.',
        'ContentItemReference position is invalid.',
      );
    });

    it('rehydrates without replacing the reference identity', () => {
      const id = ContentItemReferenceId.from('content-ref-001');

      const reference = rehydrateContentItemReference({
        id,
        learningUnitId,
        contentItemTargetId: 'content-item-001',
        position: 3,
      });

      expect(reference.id.equals(id)).toBe(true);
      expect(reference.learningUnitId.equals(learningUnitId)).toBe(true);
      expect(reference.contentItemTargetId).toBe('content-item-001');
      expect(reference.position).toBe(3);
      expect(Object.isFrozen(reference)).toBe(true);
    });

    it('does not allow mutation through the returned object', () => {
      const reference = createContentItemReference({
        learningUnitId,
        contentItemTargetId: 'content-item-001',
        position: 1,
      });

      expect(() => {
        (
          reference as {
            position: number;
          }
        ).position = 2;
      }).toThrow();

      expect(reference.position).toBe(1);
    });
  });

  describe('AssessmentReference', () => {
    it('creates an immutable assessment reference', () => {
      const reference = createAssessmentReference({
        learningUnitId,
        assessmentTargetId: 'assessment-001',
        position: 1,
      });

      expect(reference.id).toBeInstanceOf(AssessmentReferenceId);
      expect(reference.learningUnitId.equals(learningUnitId)).toBe(true);
      expect(reference.assessmentTargetId).toBe('assessment-001');
      expect(reference.position).toBe(1);
      expect(Object.isFrozen(reference)).toBe(true);
    });

    it('generates distinct structural reference identities', () => {
      const first = createAssessmentReference({
        learningUnitId,
        assessmentTargetId: 'assessment-001',
        position: 1,
      });

      const second = createAssessmentReference({
        learningUnitId,
        assessmentTargetId: 'assessment-002',
        position: 2,
      });

      expect(first.id.equals(second.id)).toBe(false);
    });

    it('keeps structural reference identity separate from target identity', () => {
      const first = createAssessmentReference({
        learningUnitId,
        assessmentTargetId: 'assessment-001',
        position: 1,
      });

      const second = createAssessmentReference({
        learningUnitId,
        assessmentTargetId: 'assessment-001',
        position: 2,
      });

      expect(first.assessmentTargetId).toBe(second.assessmentTargetId);
      expect(first.id.equals(second.id)).toBe(false);
    });

    it('supports the same target being referenced in different LearningUnits', () => {
      const first = createAssessmentReference({
        learningUnitId: LearningUnitId.from('learning-unit-001'),
        assessmentTargetId: 'assessment-001',
        position: 1,
      });

      const second = createAssessmentReference({
        learningUnitId: LearningUnitId.from('learning-unit-002'),
        assessmentTargetId: 'assessment-001',
        position: 1,
      });

      expect(first.assessmentTargetId).toBe(second.assessmentTargetId);
      expect(first.learningUnitId.equals(second.learningUnitId)).toBe(false);
    });

    it('rejects an empty target identifier', () => {
      expectValidationIssue(
        () =>
          createAssessmentReference({
            learningUnitId,
            assessmentTargetId: '',
            position: 1,
          }),
        'assessmentTargetId',
        'Assessment target identifier must be a non-empty string.',
        'AssessmentReference target identifier is required.',
      );
    });

    it('rejects a whitespace-only target identifier', () => {
      expectValidationIssue(
        () =>
          createAssessmentReference({
            learningUnitId,
            assessmentTargetId: '   ',
            position: 1,
          }),
        'assessmentTargetId',
        'Assessment target identifier must be a non-empty string.',
        'AssessmentReference target identifier is required.',
      );
    });

    it('rejects a target identifier with leading whitespace', () => {
      expectValidationIssue(
        () =>
          createAssessmentReference({
            learningUnitId,
            assessmentTargetId: ' assessment-001',
            position: 1,
          }),
        'assessmentTargetId',
        'Assessment target identifier must not contain leading or trailing whitespace.',
        'AssessmentReference target identifier is invalid.',
      );
    });

    it('rejects a target identifier with trailing whitespace', () => {
      expectValidationIssue(
        () =>
          createAssessmentReference({
            learningUnitId,
            assessmentTargetId: 'assessment-001 ',
            position: 1,
          }),
        'assessmentTargetId',
        'Assessment target identifier must not contain leading or trailing whitespace.',
        'AssessmentReference target identifier is invalid.',
      );
    });

    it('rejects an invalid position', () => {
      expectValidationIssue(
        () =>
          createAssessmentReference({
            learningUnitId,
            assessmentTargetId: 'assessment-001',
            position: 0,
          }),
        'position',
        'Assessment reference position must be a positive integer.',
        'AssessmentReference position is invalid.',
      );
    });

    it('rejects a fractional position', () => {
      expectValidationIssue(
        () =>
          createAssessmentReference({
            learningUnitId,
            assessmentTargetId: 'assessment-001',
            position: 1.5,
          }),
        'position',
        'Assessment reference position must be a positive integer.',
        'AssessmentReference position is invalid.',
      );
    });

    it('rehydrates without replacing the reference identity', () => {
      const id = AssessmentReferenceId.from('assessment-ref-001');

      const reference = rehydrateAssessmentReference({
        id,
        learningUnitId,
        assessmentTargetId: 'assessment-001',
        position: 3,
      });

      expect(reference.id.equals(id)).toBe(true);
      expect(reference.learningUnitId.equals(learningUnitId)).toBe(true);
      expect(reference.assessmentTargetId).toBe('assessment-001');
      expect(reference.position).toBe(3);
      expect(Object.isFrozen(reference)).toBe(true);
    });

    it('does not allow mutation through the returned object', () => {
      const reference = createAssessmentReference({
        learningUnitId,
        assessmentTargetId: 'assessment-001',
        position: 1,
      });

      expect(() => {
        (
          reference as {
            position: number;
          }
        ).position = 2;
      }).toThrow();

      expect(reference.position).toBe(1);
    });
  });
});
