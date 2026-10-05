export const EnrollmentDomainErrorCode = {
  VALIDATION: 'LEARNING_ENROLLMENT_VALIDATION',
  INVALID_TRANSITION: 'LEARNING_ENROLLMENT_INVALID_TRANSITION',
  DUPLICATE_ACTIVE: 'LEARNING_ENROLLMENT_DUPLICATE_ACTIVE',
  COURSE_NOT_AVAILABLE: 'LEARNING_ENROLLMENT_COURSE_NOT_AVAILABLE',
  COURSE_VERSION_NOT_AVAILABLE:
    'LEARNING_ENROLLMENT_COURSE_VERSION_NOT_AVAILABLE',
} as const;

export type EnrollmentDomainErrorCode =
  (typeof EnrollmentDomainErrorCode)[keyof typeof EnrollmentDomainErrorCode];

export interface EnrollmentValidationIssue {
  readonly field: string;
  readonly message: string;
}

export class EnrollmentDomainError extends Error {
  readonly code: EnrollmentDomainErrorCode;
  readonly issues: readonly EnrollmentValidationIssue[];

  constructor(
    message: string,
    code: EnrollmentDomainErrorCode,
    issues: readonly EnrollmentValidationIssue[] = [],
    options?: {
      readonly cause?: unknown;
    },
  ) {
    super(message, {
      cause: options?.cause,
    });

    this.name = 'EnrollmentDomainError';
    this.code = code;
    this.issues = Object.freeze(
      issues.map((issue) =>
        Object.freeze({
          field: issue.field,
          message: issue.message,
        }),
      ),
    );
  }
}

export class EnrollmentValidationError extends EnrollmentDomainError {
  constructor(
    message: string,
    issues: readonly EnrollmentValidationIssue[],
    options?: {
      readonly cause?: unknown;
    },
  ) {
    super(message, EnrollmentDomainErrorCode.VALIDATION, issues, options);

    this.name = 'EnrollmentValidationError';
  }
}

export class InvalidEnrollmentTransitionError extends EnrollmentDomainError {
  constructor(message: string, issues: readonly EnrollmentValidationIssue[]) {
    super(message, EnrollmentDomainErrorCode.INVALID_TRANSITION, issues);

    this.name = 'InvalidEnrollmentTransitionError';
  }
}
