import { describe, expect, it } from 'vitest';

import {
  Entitlement,
  EntitlementStatus,
  EntitlementSource,
  EntitlementValidationError,
  InvalidEntitlementTransitionError,
  type EntitlementProps,
} from './index.js';

const BASE_NOW = new Date('2026-10-05T12:00:00.000Z');
const STARTS_AT = new Date('2026-10-05T13:00:00.000Z');
const EXPIRES_AT = new Date('2026-10-05T15:00:00.000Z');

function createEntitlement(
  overrides: Partial<{
    startsAt: Date;
    expiresAt: Date | null;
    now: Date;
  }> = {},
): Entitlement {
  return Entitlement.create({
    enrollmentId: 'enrollment-001',
    source: EntitlementSource.DIRECT,
    startsAt: overrides.startsAt ?? BASE_NOW,
    expiresAt:
      overrides.expiresAt === undefined ? EXPIRES_AT : overrides.expiresAt,
    now: overrides.now ?? BASE_NOW,
  });
}

function rehydrateEntitlement(
  overrides: Partial<EntitlementProps> = {},
): Entitlement {
  return Entitlement.rehydrate({
    id: 'entitlement-001',
    enrollmentId: 'enrollment-001',
    status: EntitlementStatus.ACTIVE,
    source: EntitlementSource.DIRECT,
    startsAt: BASE_NOW,
    expiresAt: EXPIRES_AT,
    revokedAt: null,
    createdAt: BASE_NOW,
    updatedAt: BASE_NOW,
    ...overrides,
  });
}

describe('Entitlement aggregate', () => {
  describe('create', () => {
    it('creates an ACTIVE entitlement', () => {
      const entitlement = createEntitlement();

      expect(entitlement.status).toBe(EntitlementStatus.ACTIVE);
      expect(entitlement.enrollmentId).toBe('enrollment-001');
      expect(entitlement.source).toBe(EntitlementSource.DIRECT);
      expect(entitlement.startsAt).toEqual(BASE_NOW);
      expect(entitlement.expiresAt).toEqual(EXPIRES_AT);
      expect(entitlement.revokedAt).toBeNull();
      expect(entitlement.createdAt).toEqual(BASE_NOW);
      expect(entitlement.updatedAt).toEqual(BASE_NOW);
    });

    it('creates a non-expiring entitlement when expiresAt is null', () => {
      const entitlement = createEntitlement({
        expiresAt: null,
      });

      expect(entitlement.expiresAt).toBeNull();
      expect(entitlement.isCurrentlyUsable(BASE_NOW)).toBe(true);
    });

    it('emits exactly one granted domain event', () => {
      const entitlement = createEntitlement();

      const events = entitlement.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        eventName: 'learning.entitlement.granted',
        eventVersion: 1,
        aggregateId: entitlement.id,
        occurredAt: BASE_NOW,
        payload: {
          entitlementId: entitlement.id,
          enrollmentId: 'enrollment-001',
          source: EntitlementSource.DIRECT,
          status: EntitlementStatus.ACTIVE,
          startsAt: BASE_NOW,
          expiresAt: EXPIRES_AT,
        },
      });
    });

    it('creates a unique aggregate identifier', () => {
      const first = createEntitlement();
      const second = createEntitlement();

      expect(first.id).not.toBe(second.id);
    });
  });

  describe('validation', () => {
    it('rejects an empty entitlement identifier during rehydration', () => {
      expect(() =>
        rehydrateEntitlement({
          id: '   ',
        }),
      ).toThrowError(EntitlementValidationError);
    });

    it('rejects an empty enrollment identifier during rehydration', () => {
      expect(() =>
        rehydrateEntitlement({
          enrollmentId: '   ',
        }),
      ).toThrowError(EntitlementValidationError);
    });

    it('rejects an invalid start timestamp', () => {
      expect(() =>
        rehydrateEntitlement({
          startsAt: new Date('invalid'),
        }),
      ).toThrowError(EntitlementValidationError);
    });

    it('rejects an invalid expiration timestamp', () => {
      expect(() =>
        rehydrateEntitlement({
          expiresAt: new Date('invalid'),
        }),
      ).toThrowError(EntitlementValidationError);
    });

    it('rejects an invalid revocation timestamp', () => {
      expect(() =>
        rehydrateEntitlement({
          status: EntitlementStatus.REVOKED,
          revokedAt: new Date('invalid'),
        }),
      ).toThrowError(EntitlementValidationError);
    });

    it('rejects an invalid creation timestamp', () => {
      expect(() =>
        rehydrateEntitlement({
          createdAt: new Date('invalid'),
        }),
      ).toThrowError(EntitlementValidationError);
    });

    it('rejects an invalid update timestamp', () => {
      expect(() =>
        rehydrateEntitlement({
          updatedAt: new Date('invalid'),
        }),
      ).toThrowError(EntitlementValidationError);
    });

    it('rejects an expiration before the start time', () => {
      expect(() =>
        rehydrateEntitlement({
          startsAt: EXPIRES_AT,
          expiresAt: STARTS_AT,
        }),
      ).toThrowError(EntitlementValidationError);
    });

    it('allows an expiration exactly at the start time', () => {
      const entitlement = rehydrateEntitlement({
        startsAt: STARTS_AT,
        expiresAt: STARTS_AT,
      });

      expect(entitlement.startsAt).toEqual(STARTS_AT);
      expect(entitlement.expiresAt).toEqual(STARTS_AT);
    });

    it('requires revokedAt for a revoked entitlement', () => {
      expect(() =>
        rehydrateEntitlement({
          status: EntitlementStatus.REVOKED,
          revokedAt: null,
        }),
      ).toThrowError(EntitlementValidationError);
    });

    it('does not allow revokedAt on an active entitlement', () => {
      expect(() =>
        rehydrateEntitlement({
          status: EntitlementStatus.ACTIVE,
          revokedAt: BASE_NOW,
        }),
      ).toThrowError(EntitlementValidationError);
    });

    it('does not allow revokedAt on a suspended entitlement', () => {
      expect(() =>
        rehydrateEntitlement({
          status: EntitlementStatus.SUSPENDED,
          revokedAt: BASE_NOW,
        }),
      ).toThrowError(EntitlementValidationError);
    });

    it('does not allow revokedAt on an expired entitlement', () => {
      expect(() =>
        rehydrateEntitlement({
          status: EntitlementStatus.EXPIRED,
          revokedAt: BASE_NOW,
        }),
      ).toThrowError(EntitlementValidationError);
    });
  });

  describe('suspend', () => {
    it('transitions ACTIVE to SUSPENDED', () => {
      const entitlement = createEntitlement();
      const transitionAt = new Date('2026-10-05T12:30:00.000Z');

      entitlement.suspend(transitionAt);

      expect(entitlement.status).toBe(EntitlementStatus.SUSPENDED);
      expect(entitlement.updatedAt).toEqual(transitionAt);
      expect(entitlement.revokedAt).toBeNull();
    });

    it('emits a suspended event with the correct lifecycle payload', () => {
      const entitlement = createEntitlement();

      entitlement.pullDomainEvents();

      const transitionAt = new Date('2026-10-05T12:30:00.000Z');

      entitlement.suspend(transitionAt);

      const events = entitlement.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        eventName: 'learning.entitlement.suspended',
        eventVersion: 1,
        aggregateId: entitlement.id,
        occurredAt: transitionAt,
        payload: {
          entitlementId: entitlement.id,
          enrollmentId: entitlement.enrollmentId,
          previousStatus: EntitlementStatus.ACTIVE,
          currentStatus: EntitlementStatus.SUSPENDED,
        },
      });
    });

    it('rejects suspension from SUSPENDED', () => {
      const entitlement = createEntitlement();

      entitlement.suspend(BASE_NOW);

      expect(() =>
        entitlement.suspend(new Date('2026-10-05T12:31:00.000Z')),
      ).toThrowError(InvalidEntitlementTransitionError);
    });

    it('rejects suspension from REVOKED', () => {
      const entitlement = createEntitlement();

      entitlement.revoke(BASE_NOW);

      expect(() => entitlement.suspend(BASE_NOW)).toThrowError(
        InvalidEntitlementTransitionError,
      );
    });

    it('rejects suspension from EXPIRED', () => {
      const entitlement = createEntitlement();

      entitlement.expire(BASE_NOW);

      expect(() => entitlement.suspend(BASE_NOW)).toThrowError(
        InvalidEntitlementTransitionError,
      );
    });
  });

  describe('restore', () => {
    it('transitions SUSPENDED to ACTIVE', () => {
      const entitlement = createEntitlement();

      entitlement.suspend(BASE_NOW);

      const restoredAt = new Date('2026-10-05T12:30:00.000Z');

      entitlement.restore(restoredAt);

      expect(entitlement.status).toBe(EntitlementStatus.ACTIVE);
      expect(entitlement.updatedAt).toEqual(restoredAt);
      expect(entitlement.revokedAt).toBeNull();
    });

    it('emits a restored event with the correct lifecycle payload', () => {
      const entitlement = createEntitlement();

      entitlement.pullDomainEvents();

      entitlement.suspend(BASE_NOW);
      entitlement.pullDomainEvents();

      const restoredAt = new Date('2026-10-05T12:30:00.000Z');

      entitlement.restore(restoredAt);

      const events = entitlement.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        eventName: 'learning.entitlement.restored',
        eventVersion: 1,
        aggregateId: entitlement.id,
        occurredAt: restoredAt,
        payload: {
          previousStatus: EntitlementStatus.SUSPENDED,
          currentStatus: EntitlementStatus.ACTIVE,
        },
      });
    });

    it('rejects restore from ACTIVE', () => {
      const entitlement = createEntitlement();

      expect(() => entitlement.restore(BASE_NOW)).toThrowError(
        InvalidEntitlementTransitionError,
      );
    });

    it('rejects restore from REVOKED', () => {
      const entitlement = createEntitlement();

      entitlement.revoke(BASE_NOW);

      expect(() => entitlement.restore(BASE_NOW)).toThrowError(
        InvalidEntitlementTransitionError,
      );
    });

    it('rejects restore from EXPIRED', () => {
      const entitlement = createEntitlement();

      entitlement.expire(BASE_NOW);

      expect(() => entitlement.restore(BASE_NOW)).toThrowError(
        InvalidEntitlementTransitionError,
      );
    });
  });

  describe('revoke', () => {
    it('transitions ACTIVE to REVOKED', () => {
      const entitlement = createEntitlement();

      const revokedAt = new Date('2026-10-05T12:30:00.000Z');

      entitlement.revoke(revokedAt);

      expect(entitlement.status).toBe(EntitlementStatus.REVOKED);
      expect(entitlement.revokedAt).toEqual(revokedAt);
      expect(entitlement.updatedAt).toEqual(revokedAt);
    });

    it('transitions SUSPENDED to REVOKED', () => {
      const entitlement = createEntitlement();

      entitlement.suspend(BASE_NOW);

      const revokedAt = new Date('2026-10-05T12:30:00.000Z');

      entitlement.revoke(revokedAt);

      expect(entitlement.status).toBe(EntitlementStatus.REVOKED);
      expect(entitlement.revokedAt).toEqual(revokedAt);
    });

    it('emits a revoked event', () => {
      const entitlement = createEntitlement();

      entitlement.pullDomainEvents();

      const revokedAt = new Date('2026-10-05T12:30:00.000Z');

      entitlement.revoke(revokedAt);

      const events = entitlement.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        eventName: 'learning.entitlement.revoked',
        eventVersion: 1,
        aggregateId: entitlement.id,
        occurredAt: revokedAt,
        payload: {
          previousStatus: EntitlementStatus.ACTIVE,
          currentStatus: EntitlementStatus.REVOKED,
        },
      });
    });

    it('rejects revocation from EXPIRED', () => {
      const entitlement = createEntitlement();

      entitlement.expire(BASE_NOW);

      expect(() => entitlement.revoke(BASE_NOW)).toThrowError(
        InvalidEntitlementTransitionError,
      );
    });

    it('rejects revocation from REVOKED', () => {
      const entitlement = createEntitlement();

      entitlement.revoke(BASE_NOW);

      expect(() => entitlement.revoke(BASE_NOW)).toThrowError(
        InvalidEntitlementTransitionError,
      );
    });

    it('rejects an invalid transition timestamp', () => {
      const entitlement = createEntitlement();

      expect(() => entitlement.revoke(new Date('invalid'))).toThrowError(
        EntitlementValidationError,
      );

      expect(entitlement.status).toBe(EntitlementStatus.ACTIVE);
      expect(entitlement.revokedAt).toBeNull();
    });
  });

  describe('expire', () => {
    it('transitions ACTIVE to EXPIRED', () => {
      const entitlement = createEntitlement();

      const expiredAt = new Date('2026-10-05T16:00:00.000Z');

      entitlement.expire(expiredAt);

      expect(entitlement.status).toBe(EntitlementStatus.EXPIRED);
      expect(entitlement.updatedAt).toEqual(expiredAt);
      expect(entitlement.revokedAt).toBeNull();
    });

    it('transitions SUSPENDED to EXPIRED', () => {
      const entitlement = createEntitlement();

      entitlement.suspend(BASE_NOW);

      const expiredAt = new Date('2026-10-05T16:00:00.000Z');

      entitlement.expire(expiredAt);

      expect(entitlement.status).toBe(EntitlementStatus.EXPIRED);
      expect(entitlement.revokedAt).toBeNull();
    });

    it('emits an expired event', () => {
      const entitlement = createEntitlement();

      entitlement.pullDomainEvents();

      const expiredAt = new Date('2026-10-05T16:00:00.000Z');

      entitlement.expire(expiredAt);

      const events = entitlement.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        eventName: 'learning.entitlement.expired',
        eventVersion: 1,
        aggregateId: entitlement.id,
        occurredAt: expiredAt,
        payload: {
          previousStatus: EntitlementStatus.ACTIVE,
          currentStatus: EntitlementStatus.EXPIRED,
        },
      });
    });

    it('rejects expiration from REVOKED', () => {
      const entitlement = createEntitlement();

      entitlement.revoke(BASE_NOW);

      expect(() => entitlement.expire(BASE_NOW)).toThrowError(
        InvalidEntitlementTransitionError,
      );
    });

    it('rejects expiration from EXPIRED', () => {
      const entitlement = createEntitlement();

      entitlement.expire(BASE_NOW);

      expect(() => entitlement.expire(BASE_NOW)).toThrowError(
        InvalidEntitlementTransitionError,
      );
    });

    it('rejects an invalid transition timestamp', () => {
      const entitlement = createEntitlement();

      expect(() => entitlement.expire(new Date('invalid'))).toThrowError(
        EntitlementValidationError,
      );

      expect(entitlement.status).toBe(EntitlementStatus.ACTIVE);
    });
  });

  describe('access usability', () => {
    it('allows access at the exact start timestamp', () => {
      const entitlement = createEntitlement({
        startsAt: STARTS_AT,
        expiresAt: EXPIRES_AT,
      });

      expect(entitlement.isCurrentlyUsable(STARTS_AT)).toBe(true);
    });

    it('denies access before the start timestamp', () => {
      const entitlement = createEntitlement({
        startsAt: STARTS_AT,
        expiresAt: EXPIRES_AT,
      });

      const beforeStart = new Date('2026-10-05T12:59:59.999Z');

      expect(entitlement.isCurrentlyUsable(beforeStart)).toBe(false);
    });

    it('allows access immediately before expiry', () => {
      const entitlement = createEntitlement({
        startsAt: STARTS_AT,
        expiresAt: EXPIRES_AT,
      });

      const beforeExpiry = new Date('2026-10-05T14:59:59.999Z');

      expect(entitlement.isCurrentlyUsable(beforeExpiry)).toBe(true);
    });

    it('denies access at the exact expiry timestamp', () => {
      const entitlement = createEntitlement({
        startsAt: STARTS_AT,
        expiresAt: EXPIRES_AT,
      });

      expect(entitlement.isCurrentlyUsable(EXPIRES_AT)).toBe(false);
    });

    it('denies access after expiry', () => {
      const entitlement = createEntitlement({
        startsAt: STARTS_AT,
        expiresAt: EXPIRES_AT,
      });

      const afterExpiry = new Date('2026-10-05T15:00:00.001Z');

      expect(entitlement.isCurrentlyUsable(afterExpiry)).toBe(false);
    });

    it('denies access while suspended', () => {
      const entitlement = createEntitlement();

      entitlement.suspend(BASE_NOW);

      expect(entitlement.isCurrentlyUsable(BASE_NOW)).toBe(false);
    });

    it('allows access again after restoration', () => {
      const entitlement = createEntitlement();

      entitlement.suspend(BASE_NOW);
      entitlement.restore(new Date('2026-10-05T12:30:00.000Z'));

      expect(
        entitlement.isCurrentlyUsable(new Date('2026-10-05T12:45:00.000Z')),
      ).toBe(true);
    });

    it('denies access after revocation', () => {
      const entitlement = createEntitlement();

      entitlement.revoke(BASE_NOW);

      expect(entitlement.isCurrentlyUsable(BASE_NOW)).toBe(false);
    });

    it('denies access after expiration', () => {
      const entitlement = createEntitlement();

      entitlement.expire(BASE_NOW);

      expect(entitlement.isCurrentlyUsable(BASE_NOW)).toBe(false);
    });

    it('throws when access evaluation time is invalid', () => {
      const entitlement = createEntitlement();

      expect(() =>
        entitlement.isCurrentlyUsable(new Date('invalid')),
      ).toThrowError(EntitlementValidationError);
    });
  });

  describe('domain event lifecycle', () => {
    it('returns a defensive copy from getDomainEvents', () => {
      const entitlement = createEntitlement();

      const events = entitlement.getDomainEvents();

      expect(events).toHaveLength(1);

      const mutableEvents = [...events];

      mutableEvents.length = 0;

      expect(mutableEvents).toHaveLength(0);
      expect(entitlement.getDomainEvents()).toHaveLength(1);
    });

    it('pulls events and clears the aggregate event queue', () => {
      const entitlement = createEntitlement();

      expect(entitlement.getDomainEvents()).toHaveLength(1);

      const events = entitlement.pullDomainEvents();

      expect(events).toHaveLength(1);
      expect(entitlement.getDomainEvents()).toHaveLength(0);
    });

    it('preserves events until they are explicitly pulled', () => {
      const entitlement = createEntitlement();

      entitlement.suspend(new Date('2026-10-05T12:30:00.000Z'));

      expect(entitlement.getDomainEvents()).toHaveLength(2);
    });

    it('does not lose an event when a transition fails', () => {
      const entitlement = createEntitlement();

      expect(() => entitlement.suspend(new Date('invalid'))).toThrowError(
        EntitlementValidationError,
      );

      expect(entitlement.status).toBe(EntitlementStatus.ACTIVE);
      expect(entitlement.getDomainEvents()).toHaveLength(1);
    });
  });

  describe('rehydration', () => {
    it('rehydrates a valid active entitlement', () => {
      const entitlement = rehydrateEntitlement();

      expect(entitlement.toPrimitives()).toEqual({
        id: 'entitlement-001',
        enrollmentId: 'enrollment-001',
        status: EntitlementStatus.ACTIVE,
        source: EntitlementSource.DIRECT,
        startsAt: BASE_NOW,
        expiresAt: EXPIRES_AT,
        revokedAt: null,
        createdAt: BASE_NOW,
        updatedAt: BASE_NOW,
      });
    });

    it('rehydrates a valid revoked entitlement', () => {
      const revokedAt = new Date('2026-10-05T12:30:00.000Z');

      const entitlement = rehydrateEntitlement({
        status: EntitlementStatus.REVOKED,
        revokedAt,
        updatedAt: revokedAt,
      });

      expect(entitlement.status).toBe(EntitlementStatus.REVOKED);
      expect(entitlement.revokedAt).toEqual(revokedAt);
    });

    it('does not generate a new event during rehydration', () => {
      const entitlement = rehydrateEntitlement();

      expect(entitlement.getDomainEvents()).toHaveLength(0);
    });
  });
});
