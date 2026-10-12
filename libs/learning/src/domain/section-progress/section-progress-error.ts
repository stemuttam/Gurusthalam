export const SectionProgressDomainErrorCode = {
  VALIDATION: 'SECTION_PROGRESS_VALIDATION',
  INVALID_TRANSITION: 'SECTION_PROGRESS_INVALID_TRANSITION',
} as const;

export type SectionProgressDomainErrorCode =
  (typeof SectionProgressDomainErrorCode)[keyof typeof SectionProgressDomainErrorCode];

export interface SectionProgressValidationIssue {
  readonly field: string;
  readonly message: string;
}

export class SectionProgressDomainError extends Error {
  readonly code: SectionProgressDomainErrorCode;

  readonly issues: readonly SectionProgressValidationIssue[];

  constructor(
    message: string,
    code: SectionProgressDomainErrorCode,
    issues: readonly SectionProgressValidationIssue[] = [],
    options?: {
      readonly cause?: unknown;
    },
  ) {
    super(message, {
      cause: options?.cause,
    });

    this.name = 'SectionProgressDomainError';

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

export class SectionProgressValidationError extends SectionProgressDomainError {
  constructor(
    message: string,
    issues: readonly SectionProgressValidationIssue[] = [],
    options?: {
      readonly cause?: unknown;
    },
  ) {
    super(message, SectionProgressDomainErrorCode.VALIDATION, issues, options);

    this.name = 'SectionProgressValidationError';
  }
}

export class InvalidSectionProgressTransitionError extends SectionProgressDomainError {
  constructor(
    message: string,
    issues: readonly SectionProgressValidationIssue[] = [],
  ) {
    super(message, SectionProgressDomainErrorCode.INVALID_TRANSITION, issues);

    this.name = 'InvalidSectionProgressTransitionError';
  }
}
