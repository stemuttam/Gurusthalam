export const EnrollmentCompletionErrorCode = {
  VALIDATION: 'VALIDATION',
  ENROLLMENT_NOT_FOUND: 'ENROLLMENT_NOT_FOUND',
  ENROLLMENT_NOT_ACTIVE: 'ENROLLMENT_NOT_ACTIVE',
  COURSE_STRUCTURE_NOT_FOUND: 'COURSE_STRUCTURE_NOT_FOUND',
  COURSE_HAS_NO_LEARNING_UNITS: 'COURSE_HAS_NO_LEARNING_UNITS',
  LEARNING_UNITS_INCOMPLETE: 'LEARNING_UNITS_INCOMPLETE',
} as const;

export type EnrollmentCompletionErrorCode =
  (typeof EnrollmentCompletionErrorCode)[keyof typeof EnrollmentCompletionErrorCode];

export interface EnrollmentCompletionErrorIssue {
  readonly field: string;
  readonly message: string;
}

export class EnrollmentCompletionApplicationError extends Error {
  readonly code: EnrollmentCompletionErrorCode;
  readonly issues: readonly EnrollmentCompletionErrorIssue[];

  constructor(
    message: string,
    code: EnrollmentCompletionErrorCode,
    issues: readonly EnrollmentCompletionErrorIssue[] = [],
    options?: {
      readonly cause?: unknown;
    },
  ) {
    super(message, { cause: options?.cause });

    this.name = 'EnrollmentCompletionApplicationError';
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
