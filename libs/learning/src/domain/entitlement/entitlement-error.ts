export const EntitlementDomainErrorCode = {
  VALIDATION: 'LEARNING_ENTITLEMENT_VALIDATION',
  INVALID_TRANSITION: 'LEARNING_ENTITLEMENT_INVALID_TRANSITION',
  DUPLICATE_ACTIVE: 'LEARNING_ENTITLEMENT_DUPLICATE_ACTIVE',
  ENROLLMENT_NOT_ELIGIBLE: 'LEARNING_ENTITLEMENT_ENROLLMENT_NOT_ELIGIBLE',
} as const;

export type EntitlementDomainErrorCode =
  (typeof EntitlementDomainErrorCode)[keyof typeof EntitlementDomainErrorCode];

export interface EntitlementValidationIssue {
  readonly field: string;
  readonly message: string;
}

export class EntitlementDomainError extends Error {
  readonly code: EntitlementDomainErrorCode;
  readonly issues: readonly EntitlementValidationIssue[];

  constructor(
    message: string,
    code: EntitlementDomainErrorCode,
    issues: readonly EntitlementValidationIssue[] = [],
    options?: {
      readonly cause?: unknown;
    },
  ) {
    super(message, {
      cause: options?.cause,
    });

    this.name = 'EntitlementDomainError';
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

export class EntitlementValidationError extends EntitlementDomainError {
  constructor(
    message: string,
    issues: readonly EntitlementValidationIssue[],
    options?: {
      readonly cause?: unknown;
    },
  ) {
    super(message, EntitlementDomainErrorCode.VALIDATION, issues, options);

    this.name = 'EntitlementValidationError';
  }
}

export class InvalidEntitlementTransitionError extends EntitlementDomainError {
  constructor(message: string, issues: readonly EntitlementValidationIssue[]) {
    super(message, EntitlementDomainErrorCode.INVALID_TRANSITION, issues);

    this.name = 'InvalidEntitlementTransitionError';
  }
}
