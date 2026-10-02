import {
  CourseDomainError,
  CourseDomainErrorCode,
} from './course-domain.error.js';

export interface CourseValidationIssue {
  readonly field: string;
  readonly message: string;
}

/**
 * Raised when a Course violates one or more domain validation rules.
 *
 * This is the canonical Course validation-error contract shared by:
 *
 * - domain validation;
 * - application input validation;
 * - query validation;
 * - command validation;
 * - lifecycle-related validation failures;
 * - API error mapping.
 *
 * The error itself remains framework-independent.
 */
export class CourseValidationError extends CourseDomainError {
  readonly issues: readonly CourseValidationIssue[];

  constructor(
    message: string,
    issues: readonly CourseValidationIssue[] = [],
    options?: ErrorOptions,
  ) {
    super(message, CourseDomainErrorCode.VALIDATION_ERROR, options);

    this.name = 'CourseValidationError';

    /**
     * Copy and freeze every issue so callers cannot mutate either:
     *
     * 1. the original caller-owned issue objects; or
     * 2. the objects exposed through this error.
     */
    this.issues = Object.freeze(
      issues.map((issue) =>
        Object.freeze({
          field: issue.field,
          message: issue.message,
        }),
      ),
    );

    Object.setPrototypeOf(this, new.target.prototype);
  }
}
