import type { EntitlementAccessDecisionReason } from '../policies/entitlement-access.policy.js';

export const ProgressApplicationErrorCode = {
  ACCESS_DENIED: 'PROGRESS_ACCESS_DENIED',
} as const;

export type ProgressApplicationErrorCode =
  (typeof ProgressApplicationErrorCode)[keyof typeof ProgressApplicationErrorCode];

export type ProgressAccessDeniedReason = Exclude<
  EntitlementAccessDecisionReason,
  'ALLOWED'
>;

export interface ProgressApplicationErrorIssue {
  readonly field: string;
  readonly message: string;
}

export class ProgressApplicationError extends Error {
  readonly code: ProgressApplicationErrorCode;

  readonly issues: readonly ProgressApplicationErrorIssue[];

  constructor(
    message: string,
    code: ProgressApplicationErrorCode,
    issues: readonly ProgressApplicationErrorIssue[] = [],
    options?: {
      readonly cause?: unknown;
    },
  ) {
    super(message, {
      cause: options?.cause,
    });

    this.name = 'ProgressApplicationError';
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

export class ProgressAccessDeniedError extends ProgressApplicationError {
  readonly reason: ProgressAccessDeniedReason;

  constructor(
    reason: ProgressAccessDeniedReason,
    issues: readonly ProgressApplicationErrorIssue[] = [],
  ) {
    super(
      `Progress access is denied: ${reason}.`,
      ProgressApplicationErrorCode.ACCESS_DENIED,
      issues,
    );

    this.name = 'ProgressAccessDeniedError';
    this.reason = reason;
  }
}
