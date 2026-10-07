export const LearningSessionDomainErrorCode = {
  VALIDATION: 'LEARNING_SESSION_VALIDATION',
  INVALID_TRANSITION: 'LEARNING_SESSION_INVALID_TRANSITION',
} as const;

export type LearningSessionDomainErrorCode =
  (typeof LearningSessionDomainErrorCode)[keyof typeof LearningSessionDomainErrorCode];

export interface LearningSessionValidationIssue {
  readonly field: string;
  readonly message: string;
}

export class LearningSessionDomainError extends Error {
  readonly code: LearningSessionDomainErrorCode;
  readonly issues: readonly LearningSessionValidationIssue[];

  constructor(
    message: string,
    code: LearningSessionDomainErrorCode,
    issues: readonly LearningSessionValidationIssue[] = [],
    options?: {
      readonly cause?: unknown;
    },
  ) {
    super(message, {
      cause: options?.cause,
    });

    this.name = 'LearningSessionDomainError';
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

export class LearningSessionValidationError extends LearningSessionDomainError {
  constructor(
    message: string,
    issues: readonly LearningSessionValidationIssue[],
    options?: {
      readonly cause?: unknown;
    },
  ) {
    super(message, LearningSessionDomainErrorCode.VALIDATION, issues, options);

    this.name = 'LearningSessionValidationError';
  }
}

export class InvalidLearningSessionTransitionError extends LearningSessionDomainError {
  constructor(
    message: string,
    issues: readonly LearningSessionValidationIssue[],
  ) {
    super(message, LearningSessionDomainErrorCode.INVALID_TRANSITION, issues);

    this.name = 'InvalidLearningSessionTransitionError';
  }
}
