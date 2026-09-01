import { describe, expect, it } from 'vitest';

import {
  CourseDomainError,
  CourseDomainErrorCode,
  CourseValidationError,
  InvalidCourseStateTransitionError,
} from './index.js';

describe('Course domain errors', () => {
  describe('CourseDomainError', () => {
    it('creates a domain error with a stable error code', () => {
      const error = new CourseDomainError(
        'Course domain failure.',
        CourseDomainErrorCode.VALIDATION_ERROR,
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CourseDomainError);
      expect(error.name).toBe('CourseDomainError');
      expect(error.message).toBe('Course domain failure.');
      expect(error.code).toBe(
        CourseDomainErrorCode.VALIDATION_ERROR,
      );
    });

    it('preserves an error cause when provided', () => {
      const cause = new Error('Underlying failure.');

      const error = new CourseDomainError(
        'Course domain failure.',
        CourseDomainErrorCode.VALIDATION_ERROR,
        { cause },
      );

      expect(error.cause).toBe(cause);
    });
  });

  describe('CourseValidationError', () => {
    it('creates a validation error with structured issues', () => {
      const issues = [
        {
          field: 'title',
          message: 'Course title is required.',
        },
        {
          field: 'description',
          message: 'Course description is required.',
        },
      ];

      const error = new CourseValidationError(
        'Course validation failed.',
        issues,
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CourseDomainError);
      expect(error).toBeInstanceOf(CourseValidationError);
      expect(error.name).toBe('CourseValidationError');
      expect(error.message).toBe('Course validation failed.');
      expect(error.code).toBe(
        CourseDomainErrorCode.VALIDATION_ERROR,
      );
      expect(error.issues).toEqual(issues);
    });

    it('creates an empty issue collection when no issues are supplied', () => {
      const error = new CourseValidationError(
        'Course validation failed.',
      );

      expect(error.issues).toEqual([]);
    });

    it('does not expose the caller-owned issues array', () => {
      const issues = [
        {
          field: 'title',
          message: 'Course title is required.',
        },
      ];

      const error = new CourseValidationError(
        'Course validation failed.',
        issues,
      );

      issues.push({
        field: 'description',
        message: 'Course description is required.',
      });

      expect(error.issues).toHaveLength(1);
    });

    it('freezes the exposed issue collection', () => {
      const error = new CourseValidationError(
        'Course validation failed.',
        [
          {
            field: 'title',
            message: 'Course title is required.',
          },
        ],
      );

      expect(Object.isFrozen(error.issues)).toBe(true);
    });

    it('preserves the underlying cause', () => {
      const cause = new Error('Underlying validation failure.');

      const error = new CourseValidationError(
        'Course validation failed.',
        [],
        { cause },
      );

      expect(error.cause).toBe(cause);
    });
  });

  describe('InvalidCourseStateTransitionError', () => {
    it('captures the source and destination states', () => {
      const error = new InvalidCourseStateTransitionError(
        'DRAFT',
        'ARCHIVED',
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CourseDomainError);
      expect(error).toBeInstanceOf(
        InvalidCourseStateTransitionError,
      );
      expect(error.name).toBe(
        'InvalidCourseStateTransitionError',
      );
      expect(error.code).toBe(
        CourseDomainErrorCode.INVALID_STATE_TRANSITION,
      );
      expect(error.from).toBe('DRAFT');
      expect(error.to).toBe('ARCHIVED');
    });

    it('produces a deterministic error message', () => {
      const error = new InvalidCourseStateTransitionError(
        'PUBLISHED',
        'DRAFT',
      );

      expect(error.message).toBe(
        'Invalid Course status transition from "PUBLISHED" to "DRAFT".',
      );
    });

    it('preserves the underlying cause', () => {
      const cause = new Error('State machine failure.');

      const error = new InvalidCourseStateTransitionError(
        'DRAFT',
        'IN_REVIEW',
        { cause },
      );

      expect(error.cause).toBe(cause);
    });
  });
});