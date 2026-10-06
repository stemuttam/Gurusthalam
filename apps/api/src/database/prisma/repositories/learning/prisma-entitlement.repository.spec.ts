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
  return {
    entitlement: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
  } as unknown as PrismaClient;
}

describe('PrismaEntitlementRepository', () => {
  it('returns null when Entitlement does not exist', async () => {
    const prisma = createPrismaMock();

    vi.mocked(prisma.entitlement.findUnique).mockResolvedValue(null);

    const repository = new PrismaEntitlementRepository(prisma);

    const result = await repository.findById('missing-entitlement');

    expect(result).toBeNull();

    expect(prisma.entitlement.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'missing-entitlement',
      },
    });
  });

  it('rehydrates an Entitlement without generating domain events', async () => {
    const prisma = createPrismaMock();

    const record = createPersistenceRecord();

    vi.mocked(prisma.entitlement.findUnique).mockResolvedValue(record as never);

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
    const prisma = createPrismaMock();

    const record = createPersistenceRecord({
      status: EntitlementStatus.ACTIVE,
    });

    vi.mocked(prisma.entitlement.findFirst).mockResolvedValue(record as never);

    const repository = new PrismaEntitlementRepository(prisma);

    const result = await repository.findActiveByEnrollmentId(
      record.enrollmentId,
    );

    expect(result?.id).toBe(record.id);

    expect(prisma.entitlement.findFirst).toHaveBeenCalledWith({
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
    const prisma = createPrismaMock();

    const record = createPersistenceRecord({
      status: EntitlementStatus.SUSPENDED,
    });

    vi.mocked(prisma.entitlement.findFirst).mockResolvedValue(record as never);

    const repository = new PrismaEntitlementRepository(prisma);

    const result = await repository.findActiveByEnrollmentId(
      record.enrollmentId,
    );

    expect(result?.status).toBe(EntitlementStatus.SUSPENDED);
  });

  it('returns null when no ACTIVE or SUSPENDED Entitlement exists', async () => {
    const prisma = createPrismaMock();

    vi.mocked(prisma.entitlement.findFirst).mockResolvedValue(null);

    const repository = new PrismaEntitlementRepository(prisma);

    const result = await repository.findActiveByEnrollmentId('enrollment-1');

    expect(result).toBeNull();
  });

  it('persists a newly created Entitlement', async () => {
    const prisma = createPrismaMock();

    vi.mocked(prisma.entitlement.upsert).mockResolvedValue(
      createPersistenceRecord() as never,
    );

    const repository = new PrismaEntitlementRepository(prisma);

    const entitlement = Entitlement.create({
      enrollmentId: 'enrollment-1',

      source: EntitlementSource.DIRECT,

      startsAt: STARTS_AT,

      expiresAt: EXPIRES_AT,

      now: CREATED_AT,
    });

    await repository.save(entitlement);

    expect(prisma.entitlement.upsert).toHaveBeenCalledTimes(1);

    const call = vi.mocked(prisma.entitlement.upsert).mock.calls[0];

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

    /*
     * Phase 5.2-G deliberately does not
     * drain domain events.
     */
    expect(entitlement.getDomainEvents()).toHaveLength(1);
  });

  it('persists lifecycle state without draining domain events', async () => {
    const prisma = createPrismaMock();

    vi.mocked(prisma.entitlement.upsert).mockResolvedValue(
      createPersistenceRecord({
        status: EntitlementStatus.SUSPENDED,
      }) as never,
    );

    const repository = new PrismaEntitlementRepository(prisma);

    const entitlement = Entitlement.rehydrate(createPersistenceRecord());

    entitlement.suspend(new Date('2026-10-06T08:10:00.000Z'));

    expect(entitlement.status).toBe(EntitlementStatus.SUSPENDED);

    expect(entitlement.getDomainEvents()).toHaveLength(1);

    await repository.save(entitlement);

    expect(entitlement.getDomainEvents()).toHaveLength(1);
  });

  it('maps PostgreSQL unique constraint failures through repository error boundary', async () => {
    const prisma = createPrismaMock();

    vi.mocked(prisma.entitlement.upsert).mockRejectedValue({
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
    const prisma = createPrismaMock();

    vi.mocked(prisma.entitlement.findUnique).mockRejectedValue({
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
