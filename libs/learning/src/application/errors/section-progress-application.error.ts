import type { EntitlementAccessDecisionReason } from '../policies/entitlement-access.policy.js';

export const SectionProgressApplicationErrorCode = {
  ACCESS_DENIED: 'SECTION_PROGRESS_ACCESS_DENIED',
} as const;

export type SectionProgressApplicationErrorCode =
  (typeof SectionProgressApplicationErrorCode)[keyof typeof SectionProgressApplicationErrorCode];

export type SectionProgressAccessDeniedReason = Exclude<
  EntitlementAccessDecisionReason,
  'ALLOWED'
>;

export interface SectionProgressApplicationErrorIssue {
  readonly field: string;
  readonly message: string;
}

export class SectionProgressApplicationError extends Error {
  readonly code: SectionProgressApplicationErrorCode;

  readonly issues: readonly SectionProgressApplicationErrorIssue[];

  constructor(
    message: string,
    code: SectionProgressApplicationErrorCode,
    issues: readonly SectionProgressApplicationErrorIssue[] = [],
    options?: {
      readonly cause?: unknown;
    },
  ) {
    super(message, {
      cause: options?.cause,
    });

    this.name = 'SectionProgressApplicationError';

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

export class SectionProgressAccessDeniedError extends SectionProgressApplicationError {
  readonly reason: SectionProgressAccessDeniedReason;

  constructor(
    reason: SectionProgressAccessDeniedReason,
    issues: readonly SectionProgressApplicationErrorIssue[] = [],
  ) {
    super(
      `SectionProgress access is denied: ${reason}.`,
      SectionProgressApplicationErrorCode.ACCESS_DENIED,
      issues,
    );

    this.name = 'SectionProgressAccessDeniedError';

    this.reason = reason;
  }
}