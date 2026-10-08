import type { EntitlementAccessDecisionReason } from '../policies/entitlement-access.policy.js';

export const LessonProgressApplicationErrorCode = {
  ACCESS_DENIED: 'LESSON_PROGRESS_ACCESS_DENIED',
} as const;

export type LessonProgressApplicationErrorCode =
  (typeof LessonProgressApplicationErrorCode)[keyof typeof LessonProgressApplicationErrorCode];

export type LessonProgressAccessDeniedReason = Exclude<
  EntitlementAccessDecisionReason,
  'ALLOWED'
>;

export interface LessonProgressApplicationErrorIssue {
  readonly field: string;
  readonly message: string;
}

export class LessonProgressApplicationError extends Error {
  readonly code: LessonProgressApplicationErrorCode;

  readonly issues: readonly LessonProgressApplicationErrorIssue[];

  constructor(
    message: string,
    code: LessonProgressApplicationErrorCode,
    issues: readonly LessonProgressApplicationErrorIssue[] = [],
    options?: {
      readonly cause?: unknown;
    },
  ) {
    super(message, {
      cause: options?.cause,
    });

    this.name = 'LessonProgressApplicationError';

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

export class LessonProgressAccessDeniedError extends LessonProgressApplicationError {
  readonly reason: LessonProgressAccessDeniedReason;

  constructor(
    reason: LessonProgressAccessDeniedReason,
    issues: readonly LessonProgressApplicationErrorIssue[] = [],
  ) {
    super(
      `LessonProgress access is denied: ${reason}.`,
      LessonProgressApplicationErrorCode.ACCESS_DENIED,
      issues,
    );

    this.name = 'LessonProgressAccessDeniedError';

    this.reason = reason;
  }
}
