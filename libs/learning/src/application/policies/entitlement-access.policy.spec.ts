import { describe, expect, it } from 'vitest';

import {
  EntitlementAccessDecisionReason,
  evaluateEntitlementAccess,
} from './entitlement-access.policy.js';

const STARTS_AT = new Date('2026-10-05T13:00:00.000Z');
const EXPIRES_AT = new Date('2026-10-05T15:00:00.000Z');

describe('evaluateEntitlementAccess', () => {
  it('allows ACTIVE enrollment with ACTIVE entitlement during the access window', () => {
    const now = new Date('2026-10-05T14:00:00.000Z');

    expect(
      evaluateEntitlementAccess({
        enrollmentStatus: 'ACTIVE',
        entitlementStatus: 'ACTIVE',
        startsAt: STARTS_AT,
        expiresAt: EXPIRES_AT,
        now,
      }),
    ).toEqual({
      allowed: true,
      reason: EntitlementAccessDecisionReason.ALLOWED,
      evaluatedAt: now,
    });
  });

  it('allows COMPLETED enrollment with ACTIVE entitlement', () => {
    const now = new Date('2026-10-05T14:00:00.000Z');

    expect(
      evaluateEntitlementAccess({
        enrollmentStatus: 'COMPLETED',
        entitlementStatus: 'ACTIVE',
        startsAt: STARTS_AT,
        expiresAt: EXPIRES_AT,
        now,
      }),
    ).toEqual({
      allowed: true,
      reason: EntitlementAccessDecisionReason.ALLOWED,
      evaluatedAt: now,
    });
  });

  it.each(['PENDING', 'CANCELLED', 'EXPIRED'] as const)(
    'denies %s enrollment',
    (enrollmentStatus) => {
      const now = new Date('2026-10-05T14:00:00.000Z');

      expect(
        evaluateEntitlementAccess({
          enrollmentStatus,
          entitlementStatus: 'ACTIVE',
          startsAt: STARTS_AT,
          expiresAt: EXPIRES_AT,
          now,
        }),
      ).toEqual({
        allowed: false,
        reason: EntitlementAccessDecisionReason.ENROLLMENT_NOT_ACTIVE,
        evaluatedAt: now,
      });
    },
  );

  it.each(['SUSPENDED', 'REVOKED', 'EXPIRED'] as const)(
    'denies %s entitlement',
    (entitlementStatus) => {
      const now = new Date('2026-10-05T14:00:00.000Z');

      expect(
        evaluateEntitlementAccess({
          enrollmentStatus: 'ACTIVE',
          entitlementStatus,
          startsAt: STARTS_AT,
          expiresAt: EXPIRES_AT,
          now,
        }),
      ).toEqual({
        allowed: false,
        reason: EntitlementAccessDecisionReason.ENTITLEMENT_NOT_ACTIVE,
        evaluatedAt: now,
      });
    },
  );

  it('denies access before the entitlement start time', () => {
    const now = new Date('2026-10-05T12:59:59.999Z');

    expect(
      evaluateEntitlementAccess({
        enrollmentStatus: 'ACTIVE',
        entitlementStatus: 'ACTIVE',
        startsAt: STARTS_AT,
        expiresAt: EXPIRES_AT,
        now,
      }),
    ).toEqual({
      allowed: false,
      reason: EntitlementAccessDecisionReason.ACCESS_NOT_STARTED,
      evaluatedAt: now,
    });
  });

  it('allows access exactly at the entitlement start time', () => {
    const now = STARTS_AT;

    expect(
      evaluateEntitlementAccess({
        enrollmentStatus: 'ACTIVE',
        entitlementStatus: 'ACTIVE',
        startsAt: STARTS_AT,
        expiresAt: EXPIRES_AT,
        now,
      }),
    ).toEqual({
      allowed: true,
      reason: EntitlementAccessDecisionReason.ALLOWED,
      evaluatedAt: now,
    });
  });

  it('allows access immediately before expiry', () => {
    const now = new Date('2026-10-05T14:59:59.999Z');

    expect(
      evaluateEntitlementAccess({
        enrollmentStatus: 'ACTIVE',
        entitlementStatus: 'ACTIVE',
        startsAt: STARTS_AT,
        expiresAt: EXPIRES_AT,
        now,
      }),
    ).toEqual({
      allowed: true,
      reason: EntitlementAccessDecisionReason.ALLOWED,
      evaluatedAt: now,
    });
  });

  it('denies access exactly at expiry', () => {
    const now = EXPIRES_AT;

    expect(
      evaluateEntitlementAccess({
        enrollmentStatus: 'ACTIVE',
        entitlementStatus: 'ACTIVE',
        startsAt: STARTS_AT,
        expiresAt: EXPIRES_AT,
        now,
      }),
    ).toEqual({
      allowed: false,
      reason: EntitlementAccessDecisionReason.ACCESS_EXPIRED,
      evaluatedAt: now,
    });
  });

  it('denies access after expiry', () => {
    const now = new Date('2026-10-05T15:00:00.001Z');

    expect(
      evaluateEntitlementAccess({
        enrollmentStatus: 'ACTIVE',
        entitlementStatus: 'ACTIVE',
        startsAt: STARTS_AT,
        expiresAt: EXPIRES_AT,
        now,
      }),
    ).toEqual({
      allowed: false,
      reason: EntitlementAccessDecisionReason.ACCESS_EXPIRED,
      evaluatedAt: now,
    });
  });

  it('allows an active entitlement with no expiration after its start time', () => {
    const now = new Date('2026-10-05T14:00:00.000Z');

    expect(
      evaluateEntitlementAccess({
        enrollmentStatus: 'ACTIVE',
        entitlementStatus: 'ACTIVE',
        startsAt: STARTS_AT,
        expiresAt: null,
        now,
      }),
    ).toEqual({
      allowed: true,
      reason: EntitlementAccessDecisionReason.ALLOWED,
      evaluatedAt: now,
    });
  });

  it('rejects an invalid evaluation timestamp', () => {
    expect(() =>
      evaluateEntitlementAccess({
        enrollmentStatus: 'ACTIVE',
        entitlementStatus: 'ACTIVE',
        startsAt: STARTS_AT,
        expiresAt: EXPIRES_AT,
        now: new Date('invalid'),
      }),
    ).toThrowError(RangeError);
  });
});
