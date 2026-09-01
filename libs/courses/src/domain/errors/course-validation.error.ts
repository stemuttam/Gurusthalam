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
 */
export class CourseValidationError extends CourseDomainError {
  readonly issues: readonly CourseValidationIssue[];

  constructor(
    message: string,
    issues: readonly CourseValidationIssue[] = [],
    options?: ErrorOptions,
  ) {
    super(
      message,
      CourseDomainErrorCode.VALIDATION_ERROR,
      options,
    );

    this.name = 'CourseValidationError';
    this.issues = Object.freeze([...issues]);

    Object.setPrototypeOf(this, new.target.prototype);
  }
}