export const LessonProgressDomainErrorCode = {
  VALIDATION: 'LESSON_PROGRESS_VALIDATION',
  INVALID_TRANSITION: 'LESSON_PROGRESS_INVALID_TRANSITION',
} as const;

export type LessonProgressDomainErrorCode =
  (typeof LessonProgressDomainErrorCode)[keyof typeof LessonProgressDomainErrorCode];

export interface LessonProgressValidationIssue {
  readonly field: string;
  readonly message: string;
}

export class LessonProgressDomainError extends Error {
  readonly code: LessonProgressDomainErrorCode;

  readonly issues: readonly LessonProgressValidationIssue[];

  constructor(
    message: string,
    code: LessonProgressDomainErrorCode,
    issues: readonly LessonProgressValidationIssue[] = [],
    options?: {
      readonly cause?: unknown;
    },
  ) {
    super(message, {
      cause: options?.cause,
    });

    this.name = 'LessonProgressDomainError';

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

export class LessonProgressValidationError extends LessonProgressDomainError {
  constructor(
    message: string,
    issues: readonly LessonProgressValidationIssue[],
    options?: {
      readonly cause?: unknown;
    },
  ) {
    super(message, LessonProgressDomainErrorCode.VALIDATION, issues, options);

    this.name = 'LessonProgressValidationError';
  }
}

export class InvalidLessonProgressTransitionError extends LessonProgressDomainError {
  constructor(
    message: string,
    issues: readonly LessonProgressValidationIssue[],
  ) {
    super(message, LessonProgressDomainErrorCode.INVALID_TRANSITION, issues);

    this.name = 'InvalidLessonProgressTransitionError';
  }
}
