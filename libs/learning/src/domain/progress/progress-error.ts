export const ProgressDomainErrorCode = {
  VALIDATION: 'PROGRESS_VALIDATION',
  INVALID_TRANSITION: 'PROGRESS_INVALID_TRANSITION',
} as const;

export type ProgressDomainErrorCode =
  (typeof ProgressDomainErrorCode)[keyof typeof ProgressDomainErrorCode];

export interface ProgressValidationIssue {
  readonly field: string;
  readonly message: string;
}

export class ProgressDomainError extends Error {
  readonly code: ProgressDomainErrorCode;

  readonly issues: readonly ProgressValidationIssue[];

  constructor(
    message: string,
    code: ProgressDomainErrorCode,
    issues: readonly ProgressValidationIssue[] = [],
    options?: {
      readonly cause?: unknown;
    },
  ) {
    super(message, {
      cause: options?.cause,
    });

    this.name = 'ProgressDomainError';

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

export class ProgressValidationError extends ProgressDomainError {
  constructor(
    message: string,
    issues: readonly ProgressValidationIssue[],
    options?: {
      readonly cause?: unknown;
    },
  ) {
    super(message, ProgressDomainErrorCode.VALIDATION, issues, options);

    this.name = 'ProgressValidationError';
  }
}

export class InvalidProgressTransitionError extends ProgressDomainError {
  constructor(message: string, issues: readonly ProgressValidationIssue[]) {
    super(message, ProgressDomainErrorCode.INVALID_TRANSITION, issues);

    this.name = 'InvalidProgressTransitionError';
  }
}
