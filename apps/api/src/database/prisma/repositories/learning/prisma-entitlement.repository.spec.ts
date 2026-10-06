import { describe, expect, it, vi } from 'vitest';

import {
  Entitlement,
  EntitlementSource,
  EntitlementStatus,
  type EntitlementProps,
} from '@gurusthalam/learning';

import type { PrismaClient } from '@gurusthalam/database';

import {
  PrismaRepositoryError,
  PrismaRepositoryErrorCode,
} from '../prisma-repository.error.js';

import { PrismaEntitlementRepository } from './prisma-entitlement.repository.js';

const CREATED_AT = new Date('2026-10-06T08:00:00.000Z');

const UPDATED_AT = new Date('2026-10-06T08:05:00.000Z');

const STARTS_AT = new Date('2026-10-06T08:00:00.000Z');

const EXPIRES_AT = new Date('2026-12-31T23:59:59.000Z');

function createPersistenceRecord(
  overrides: Partial<EntitlementProps> = {},
): EntitlementProps {
  return {
    id: 'entitlement-1',

    enrollmentId: 'enrollment-1',

    status: EntitlementStatus.ACTIVE,

    source: EntitlementSource.DIRECT,

    startsAt: STARTS_AT,

    expiresAt: EXPIRES_AT,

    revokedAt: null,

    createdAt: CREATED_AT,

    updatedAt: UPDATED_AT,

    ...overrides,
  };
}

function createPrismaMock() {
  const findUnique = vi.fn();

  const findFirst = vi.fn();

  const upsert = vi.fn();

  const outboxCreate = vi.fn();

  type TransactionClient = {
    entitlement: {
      upsert: typeof upsert;
    };

    outboxEvent: {
      create: typeof outboxCreate;
    };
  };

  const transactionClient: TransactionClient = {
    entitlement: {
      upsert,
    },

    outboxEvent: {
      create: outboxCreate,
    },
  };

  const transaction = vi.fn(
    async (
      callback: (transactionClient: TransactionClient) => Promise<void>,
    ): Promise<void> => callback(transactionClient),
  );

  return {
    prisma: {
      entitlement: {
        findUnique,

        findFirst,
      },

      $transaction: transaction,
    } as unknown as PrismaClient,

    mocks: {
      findUnique,

      findFirst,

      upsert,

      outboxCreate,

      transaction,
    },
  };
}

describe('PrismaEntitlementRepository', () => {
  it('returns null when Entitlement does not exist', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.findUnique.mockResolvedValue(null);

    const repository = new PrismaEntitlementRepository(prisma);

    const result = await repository.findById('missing-entitlement');

    expect(result).toBeNull();

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'missing-entitlement',
      },
    });
  });

  it('rehydrates an Entitlement without generating domain events', async () => {
    const { prisma, mocks } = createPrismaMock();

    const record = createPersistenceRecord();

    mocks.findUnique.mockResolvedValue(record as never);

    const repository = new PrismaEntitlementRepository(prisma);

    const result = await repository.findById(record.id);

    expect(result).not.toBeNull();

    expect(result?.id).toBe(record.id);

    expect(result?.enrollmentId).toBe(record.enrollmentId);

    expect(result?.status).toBe(EntitlementStatus.ACTIVE);

    expect(result?.source).toBe(EntitlementSource.DIRECT);

    expect(result?.startsAt).toEqual(STARTS_AT);

    expect(result?.expiresAt).toEqual(EXPIRES_AT);

    expect(result?.revokedAt).toBeNull();

    expect(result?.getDomainEvents()).toHaveLength(0);
  });

  it('finds ACTIVE Entitlement for an Enrollment', async () => {
    const { prisma, mocks } = createPrismaMock();

    const record = createPersistenceRecord({
      status: EntitlementStatus.ACTIVE,
    });

    mocks.findFirst.mockResolvedValue(record as never);

    const repository = new PrismaEntitlementRepository(prisma);

    const result = await repository.findActiveByEnrollmentId(
      record.enrollmentId,
    );

    expect(result?.id).toBe(record.id);

    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        enrollmentId: record.enrollmentId,

        status: {
          in: ['ACTIVE', 'SUSPENDED'],
        },
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  });

  it('finds SUSPENDED Entitlement for an Enrollment', async () => {
    const { prisma, mocks } = createPrismaMock();

    const record = createPersistenceRecord({
      status: EntitlementStatus.SUSPENDED,
    });

    mocks.findFirst.mockResolvedValue(record as never);

    const repository = new PrismaEntitlementRepository(prisma);

    const result = await repository.findActiveByEnrollmentId(
      record.enrollmentId,
    );

    expect(result?.status).toBe(EntitlementStatus.SUSPENDED);
  });

  it('returns null when no ACTIVE or SUSPENDED Entitlement exists', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.findFirst.mockResolvedValue(null);

    const repository = new PrismaEntitlementRepository(prisma);

    const result = await repository.findActiveByEnrollmentId('enrollment-1');

    expect(result).toBeNull();
  });

  it('persists a newly created Entitlement and its domain event transactionally', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.upsert.mockResolvedValue(createPersistenceRecord() as never);

    mocks.outboxCreate.mockResolvedValue({
      id: 'outbox-1',
    });

    const repository = new PrismaEntitlementRepository(prisma);

    const entitlement = Entitlement.create({
      enrollmentId: 'enrollment-1',

      source: EntitlementSource.DIRECT,

      startsAt: STARTS_AT,

      expiresAt: EXPIRES_AT,

      now: CREATED_AT,
    });

    const pendingEvents = entitlement.getDomainEvents();

    expect(pendingEvents).toHaveLength(1);

    const event = pendingEvents[0];

    if (event === undefined) {
      throw new Error('Expected Entitlement domain event.');
    }

    expect(event.eventName).toBe('learning.entitlement.granted');

    await repository.save(entitlement);

    expect(mocks.transaction).toHaveBeenCalledTimes(1);

    expect(mocks.upsert).toHaveBeenCalledTimes(1);

    expect(mocks.outboxCreate).toHaveBeenCalledTimes(1);

    const call = mocks.upsert.mock.calls[0];

    expect(call).toBeDefined();

    if (call === undefined) {
      throw new Error('Expected Entitlement upsert call.');
    }

    const args = call[0];

    expect(args.where).toEqual({
      id: entitlement.id,
    });

    expect(args.create).toMatchObject({
      id: entitlement.id,

      enrollmentId: entitlement.enrollmentId,

      status: entitlement.status,

      source: entitlement.source,

      startsAt: entitlement.startsAt,

      expiresAt: entitlement.expiresAt,

      revokedAt: null,
    });

    expect(args.update).toMatchObject({
      enrollmentId: entitlement.enrollmentId,

      status: entitlement.status,

      source: entitlement.source,

      startsAt: entitlement.startsAt,

      expiresAt: entitlement.expiresAt,

      revokedAt: null,
    });

    expect(mocks.outboxCreate).toHaveBeenCalledWith({
      data: {
        eventType: event.eventName,

        aggregateType: 'Entitlement',

        aggregateId: entitlement.id,

        dedupeKey: `learning.entitlement:${event.eventId}`,

        payload: {
          eventId: event.eventId,

          eventName: event.eventName,

          eventVersion: event.eventVersion,

          aggregateId: event.aggregateId,

          occurredAt: event.occurredAt.toISOString(),

          payload:
            event.eventName === 'learning.entitlement.granted'
              ? {
                  ...event.payload,
                  startsAt: event.payload.startsAt.toISOString(),
                  expiresAt: event.payload.expiresAt?.toISOString() ?? null,
                }
              : event.payload,
        },

        status: 'PENDING',

        attempts: 0,

        availableAt: expect.any(Date),
      },
    });

    /*
     * Phase 5.2-H:
     *
     * Domain events are drained only after the
     * transactional Entitlement + Outbox persistence
     * successfully completes.
     */
    expect(entitlement.getDomainEvents()).toHaveLength(0);
  });

  it('persists lifecycle state and drains domain events after successful transaction', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.upsert.mockResolvedValue(
      createPersistenceRecord({
        status: EntitlementStatus.SUSPENDED,
      }) as never,
    );

    mocks.outboxCreate.mockResolvedValue({
      id: 'outbox-1',
    });

    const repository = new PrismaEntitlementRepository(prisma);

    const entitlement = Entitlement.rehydrate(createPersistenceRecord());

    entitlement.suspend(new Date('2026-10-06T08:10:00.000Z'));

    expect(entitlement.status).toBe(EntitlementStatus.SUSPENDED);

    const pendingEvents = entitlement.getDomainEvents();

    expect(pendingEvents).toHaveLength(1);

    const event = pendingEvents[0];

    if (event === undefined) {
      throw new Error('Expected Entitlement lifecycle event.');
    }

    await repository.save(entitlement);

    expect(mocks.transaction).toHaveBeenCalledTimes(1);

    expect(mocks.upsert).toHaveBeenCalledTimes(1);

    expect(mocks.outboxCreate).toHaveBeenCalledTimes(1);

    expect(mocks.outboxCreate).toHaveBeenCalledWith({
      data: {
        eventType: event.eventName,

        aggregateType: 'Entitlement',

        aggregateId: entitlement.id,

        dedupeKey: `learning.entitlement:${event.eventId}`,

        payload: {
          eventId: event.eventId,

          eventName: event.eventName,

          eventVersion: event.eventVersion,

          aggregateId: event.aggregateId,

          occurredAt: event.occurredAt.toISOString(),

          payload: event.payload,
        },

        status: 'PENDING',

        attempts: 0,

        availableAt: expect.any(Date),
      },
    });

    expect(entitlement.getDomainEvents()).toHaveLength(0);
  });

  it('keeps domain events pending when the transactional Outbox write fails', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.upsert.mockResolvedValue(createPersistenceRecord() as never);

    mocks.outboxCreate.mockRejectedValue({
      code: 'P2002',

      message: 'Unique constraint failed.',
    });

    const repository = new PrismaEntitlementRepository(prisma);

    const entitlement = Entitlement.create({
      enrollmentId: 'enrollment-1',

      source: EntitlementSource.DIRECT,

      now: CREATED_AT,
    });

    expect(entitlement.getDomainEvents()).toHaveLength(1);

    await expect(repository.save(entitlement)).rejects.toMatchObject({
      code: PrismaRepositoryErrorCode.UNIQUE_CONSTRAINT,

      prismaCode: 'P2002',
    });

    expect(mocks.transaction).toHaveBeenCalledTimes(1);

    expect(mocks.upsert).toHaveBeenCalledTimes(1);

    expect(mocks.outboxCreate).toHaveBeenCalledTimes(1);

    /*
     * The transaction failed, therefore the aggregate must
     * retain its pending domain event. The repository must
     * never drain events before transaction commit.
     */
    expect(entitlement.getDomainEvents()).toHaveLength(1);
  });

  it('maps PostgreSQL unique constraint failures through repository error boundary', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.upsert.mockRejectedValue({
      code: 'P2002',

      message: 'Unique constraint failed.',
    });

    const repository = new PrismaEntitlementRepository(prisma);

    const entitlement = Entitlement.create({
      enrollmentId: 'enrollment-1',

      source: EntitlementSource.DIRECT,

      now: CREATED_AT,
    });

    await expect(repository.save(entitlement)).rejects.toMatchObject({
      code: PrismaRepositoryErrorCode.UNIQUE_CONSTRAINT,

      prismaCode: 'P2002',
    });

    expect(mocks.transaction).toHaveBeenCalledTimes(1);

    expect(mocks.upsert).toHaveBeenCalledTimes(1);

    expect(mocks.outboxCreate).not.toHaveBeenCalled();

    await expect(repository.save(entitlement)).rejects.toBeInstanceOf(
      PrismaRepositoryError,
    );

    /*
     * Persistence failure must not drain
     * domain events.
     */
    expect(entitlement.getDomainEvents()).toHaveLength(1);
  });

  it('does not leak raw Prisma errors', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.findUnique.mockRejectedValue({
      code: 'P2025',

      message: 'Record not found.',
    });

    const repository = new PrismaEntitlementRepository(prisma);

    await expect(
      repository.findById('missing-entitlement'),
    ).rejects.toBeInstanceOf(PrismaRepositoryError);

    await expect(
      repository.findById('missing-entitlement'),
    ).rejects.toMatchObject({
      code: PrismaRepositoryErrorCode.RECORD_NOT_FOUND,

      prismaCode: 'P2025',
    });
  });
});
