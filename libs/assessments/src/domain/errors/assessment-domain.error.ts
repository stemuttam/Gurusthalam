/**
 * Machine-readable error codes exposed by the Assessment domain.
 *
 * These codes are independent of HTTP status codes, framework exceptions,
 * persistence errors, and transport protocols.
 */
export const AssessmentDomainErrorCode = {
  VALIDATION_ERROR: 'ASSESSMENT_VALIDATION_ERROR',
  INVALID_STATE_TRANSITION: 'ASSESSMENT_INVALID_STATE_TRANSITION',
} as const;

export type AssessmentDomainErrorCode =
  (typeof AssessmentDomainErrorCode)[keyof typeof AssessmentDomainErrorCode];

/**
 * A field-level validation issue originating from the Assessment domain.
 */
export interface AssessmentValidationIssue {
  readonly field: string;
  readonly message: string;
}

/**
 * Base error for errors originating from the Assessment domain.
 *
 * Application and transport layers may translate this error into
 * framework-specific responses. The domain itself remains independent
 * of those frameworks.
 */
export class AssessmentDomainError extends Error {
  readonly code: AssessmentDomainErrorCode;

  readonly issues: readonly AssessmentValidationIssue[];

  constructor(
    message: string,
    code: AssessmentDomainErrorCode,
    issues: readonly AssessmentValidationIssue[] = [],
    options?: ErrorOptions,
  ) {
    super(message, options);

    this.name = 'AssessmentDomainError';
    this.code = code;
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

/**
 * Raised when Assessment domain input or rehydrated state is invalid.
 */
export class AssessmentValidationError extends AssessmentDomainError {
  constructor(
    message: string,
    issues: readonly AssessmentValidationIssue[],
    options?: ErrorOptions,
  ) {
    super(message, AssessmentDomainErrorCode.VALIDATION_ERROR, issues, options);

    this.name = 'AssessmentValidationError';
  }
}

/**
 * Raised when an Assessment lifecycle operation violates a domain rule.
 */
export class InvalidAssessmentStateTransitionError extends AssessmentDomainError {
  constructor(
    message: string,
    issues: readonly AssessmentValidationIssue[] = [],
    options?: ErrorOptions,
  ) {
    super(
      message,
      AssessmentDomainErrorCode.INVALID_STATE_TRANSITION,
      issues,
      options,
    );

    this.name = 'InvalidAssessmentStateTransitionError';
  }
}
