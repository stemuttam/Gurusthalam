import { describe, expect, it } from 'vitest';

import {
  AssessmentDomainError,
  AssessmentDomainErrorCode,
  AssessmentValidationError,
  InvalidAssessmentStateTransitionError,
} from './assessment-domain.error.js';

describe('Assessment domain errors', () => {
  describe('AssessmentDomainError', () => {
    it('creates a domain error with its machine-readable code', () => {
      const error = new AssessmentDomainError(
        'Assessment operation failed.',
        AssessmentDomainErrorCode.VALIDATION_ERROR,
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AssessmentDomainError);
      expect(error.name).toBe('AssessmentDomainError');
      expect(error.message).toBe('Assessment operation failed.');
      expect(error.code).toBe('ASSESSMENT_VALIDATION_ERROR');
      expect(error.issues).toEqual([]);
    });

    it('copies and freezes validation issues', () => {
      const sourceIssues = [
        {
          field: 'title',
          message: 'Assessment title is required.',
        },
      ];

      const error = new AssessmentDomainError(
        'Assessment validation failed.',
        AssessmentDomainErrorCode.VALIDATION_ERROR,
        sourceIssues,
      );

      sourceIssues.push({
        field: 'description',
        message: 'Description is invalid.',
      });

      expect(error.issues).toHaveLength(1);
      expect(error.issues[0]).toEqual({
        field: 'title',
        message: 'Assessment title is required.',
      });
      expect(Object.isFrozen(error.issues)).toBe(true);
      expect(Object.isFrozen(error.issues[0])).toBe(true);
    });

    it('preserves the original error cause', () => {
      const cause = new Error('Underlying failure.');

      const error = new AssessmentDomainError(
        'Assessment operation failed.',
        AssessmentDomainErrorCode.VALIDATION_ERROR,
        [],
        { cause },
      );

      expect(error.cause).toBe(cause);
    });

    it('preserves the correct prototype chain', () => {
      const error = new AssessmentDomainError(
        'Assessment operation failed.',
        AssessmentDomainErrorCode.VALIDATION_ERROR,
      );

      expect(error instanceof AssessmentDomainError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('AssessmentValidationError', () => {
    it('uses the validation error code', () => {
      const error = new AssessmentValidationError(
        'Assessment validation failed.',
        [
          {
            field: 'title',
            message: 'Assessment title is required.',
          },
        ],
      );

      expect(error).toBeInstanceOf(AssessmentDomainError);
      expect(error.name).toBe('AssessmentValidationError');
      expect(error.code).toBe(AssessmentDomainErrorCode.VALIDATION_ERROR);
      expect(error.issues).toHaveLength(1);
    });

    it('preserves the original cause', () => {
      const cause = new TypeError('Invalid input.');

      const error = new AssessmentValidationError(
        'Assessment validation failed.',
        [],
        { cause },
      );

      expect(error.cause).toBe(cause);
    });
  });

  describe('InvalidAssessmentStateTransitionError', () => {
    it('uses the invalid transition error code', () => {
      const error = new InvalidAssessmentStateTransitionError(
        'Assessment cannot be published.',
        [
          {
            field: 'status',
            message: 'Only draft assessments can be published.',
          },
        ],
      );

      expect(error).toBeInstanceOf(AssessmentDomainError);
      expect(error.name).toBe('InvalidAssessmentStateTransitionError');
      expect(error.code).toBe(
        AssessmentDomainErrorCode.INVALID_STATE_TRANSITION,
      );
      expect(error.issues).toHaveLength(1);
    });

    it('supports transition errors without field-level issues', () => {
      const error = new InvalidAssessmentStateTransitionError(
        'Assessment transition is not permitted.',
      );

      expect(error.issues).toEqual([]);
    });
  });
});
