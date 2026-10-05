import type { EnrollmentStatus } from '../../domain/enrollment/enrollment-status.js';

import type { EntitlementStatus } from '../../domain/entitlement/entitlement-status.js';

export const EntitlementAccessDecisionReason = {
  ALLOWED: 'ALLOWED',
  ENROLLMENT_NOT_ACTIVE: 'ENROLLMENT_NOT_ACTIVE',
  ENTITLEMENT_NOT_ACTIVE: 'ENTITLEMENT_NOT_ACTIVE',
  ACCESS_NOT_STARTED: 'ACCESS_NOT_STARTED',
  ACCESS_EXPIRED: 'ACCESS_EXPIRED',
} as const;

export type EntitlementAccessDecisionReason =
  (typeof EntitlementAccessDecisionReason)[keyof typeof EntitlementAccessDecisionReason];

export interface EntitlementAccessPolicyInput {
  readonly enrollmentStatus: EnrollmentStatus;
  readonly entitlementStatus: EntitlementStatus;
  readonly startsAt: Date;
  readonly expiresAt: Date | null;
  readonly now?: Date;
}

export interface EntitlementAccessDecision {
  readonly allowed: boolean;
  readonly reason: EntitlementAccessDecisionReason;
  readonly evaluatedAt: Date;
}

export function evaluateEntitlementAccess(
  input: EntitlementAccessPolicyInput,
): EntitlementAccessDecision {
  const evaluatedAt = input.now ? new Date(input.now) : new Date();

  if (Number.isNaN(evaluatedAt.getTime())) {
    throw new RangeError('Access evaluation time must be a valid Date.');
  }

  /*
   * COMPLETED remains eligible for access because completion is a
   * learning-lifecycle state, not an entitlement revocation.
   *
   * CANCELLED / EXPIRED enrollment states terminate access eligibility.
   */
  const enrollmentAllowsAccess =
    input.enrollmentStatus === 'ACTIVE' ||
    input.enrollmentStatus === 'COMPLETED';

  if (!enrollmentAllowsAccess) {
    return {
      allowed: false,
      reason: EntitlementAccessDecisionReason.ENROLLMENT_NOT_ACTIVE,
      evaluatedAt,
    };
  }

  if (input.entitlementStatus !== 'ACTIVE') {
    return {
      allowed: false,
      reason: EntitlementAccessDecisionReason.ENTITLEMENT_NOT_ACTIVE,
      evaluatedAt,
    };
  }

  if (evaluatedAt.getTime() < input.startsAt.getTime()) {
    return {
      allowed: false,
      reason: EntitlementAccessDecisionReason.ACCESS_NOT_STARTED,
      evaluatedAt,
    };
  }

  if (
    input.expiresAt !== null &&
    evaluatedAt.getTime() >= input.expiresAt.getTime()
  ) {
    return {
      allowed: false,
      reason: EntitlementAccessDecisionReason.ACCESS_EXPIRED,
      evaluatedAt,
    };
  }

  return {
    allowed: true,
    reason: EntitlementAccessDecisionReason.ALLOWED,
    evaluatedAt,
  };
}
