import { describe, expect, it, vi } from 'vitest';

import {
  Progress,
  ProgressStatus,
  type ProgressProps,
} from '@gurusthalam/learning';

import type { PrismaClient } from '@gurusthalam/database';

import {
  PrismaRepositoryError,
  PrismaRepositoryErrorCode,
} from '../prisma-repository.error.js';

import { PrismaProgressRepository } from './prisma-progress.repository.js';

const CREATED_AT = new Date('2026-10-07T08:00:00.000Z');

const STARTED_AT = new Date('2026-10-07T08:10:00.000Z');

const UPDATED_AT = new Date('2026-10-07T08:20:00.000Z');

const COMPLETED_AT = new Date('2026-10-07T08:30:00.000Z');

function createPersistenceRecord(
  overrides: Partial<ProgressProps> = {},
): ProgressProps {
  return {
    id: 'progress-1',
    enrollmentId: 'enrollment-1',
    status: ProgressStatus.NOT_STARTED,
    percentage: 0,
    startedAt: null,
    completedAt: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  };
}

function createPrismaMock() {
  const findUnique = vi.fn();

  const upsert = vi.fn();

  const outboxCreate = vi.fn();

  type TransactionClient = {
    progress: {
      upsert: typeof upsert;
    };

    outboxEvent: {
      create: typeof outboxCreate;
    };
  };

  const transactionClient: TransactionClient = {
    progress: {
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
      progress: {
        findUnique,
      },

      $transaction: transaction,
    } as unknown as PrismaClient,

    mocks: {
      findUnique,
      upsert,
      outboxCreate,
      transaction,
    },
  };
}

describe('PrismaProgressRepository', () => {
  it('returns null when Progress does not exist by id', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.findUnique.mockResolvedValue(null);

    const repository = new PrismaProgressRepository(prisma);

    const result = await repository.findById('missing-progress');

    expect(result).toBeNull();

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'missing-progress',
      },
    });
  });

  it('returns null when Progress does not exist by Enrollment', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.findUnique.mockResolvedValue(null);

    const repository = new PrismaProgressRepository(prisma);

    const result = await repository.findByEnrollmentId('missing-enrollment');

    expect(result).toBeNull();

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: {
        enrollmentId: 'missing-enrollment',
      },
    });
  });

  it('rehydrates Progress without generating domain events', async () => {
    const { prisma, mocks } = createPrismaMock();

    const record = createPersistenceRecord({
      status: ProgressStatus.IN_PROGRESS,
      percentage: 40,
      startedAt: STARTED_AT,
      updatedAt: UPDATED_AT,
    });

    mocks.findUnique.mockResolvedValue(record as never);

    const repository = new PrismaProgressRepository(prisma);

    const result = await repository.findById(record.id);

    expect(result).not.toBeNull();

    expect(result?.id).toBe(record.id);

    expect(result?.enrollmentId).toBe(record.enrollmentId);

    expect(result?.status).toBe(ProgressStatus.IN_PROGRESS);

    expect(result?.percentage).toBe(40);

    expect(result?.startedAt).toEqual(STARTED_AT);

    expect(result?.completedAt).toBeNull();

    expect(result?.getDomainEvents()).toHaveLength(0);
  });

  it('rehydrates a completed Progress correctly', async () => {
    const { prisma, mocks } = createPrismaMock();

    const record = createPersistenceRecord({
      status: ProgressStatus.COMPLETED,
      percentage: 100,
      startedAt: STARTED_AT,
      completedAt: COMPLETED_AT,
      updatedAt: COMPLETED_AT,
    });

    mocks.findUnique.mockResolvedValue(record as never);

    const repository = new PrismaProgressRepository(prisma);

    const result = await repository.findById(record.id);

    expect(result).not.toBeNull();

    expect(result?.status).toBe(ProgressStatus.COMPLETED);

    expect(result?.percentage).toBe(100);

    expect(result?.startedAt).toEqual(STARTED_AT);

    expect(result?.completedAt).toEqual(COMPLETED_AT);

    expect(result?.getDomainEvents()).toHaveLength(0);
  });

  it('finds Progress by its unique Enrollment identity', async () => {
    const { prisma, mocks } = createPrismaMock();

    const record = createPersistenceRecord({
      status: ProgressStatus.IN_PROGRESS,
      percentage: 25,
      startedAt: STARTED_AT,
      updatedAt: UPDATED_AT,
    });

    mocks.findUnique.mockResolvedValue(record as never);

    const repository = new PrismaProgressRepository(prisma);

    const result = await repository.findByEnrollmentId(record.enrollmentId);

    expect(result).not.toBeNull();

    expect(result?.id).toBe(record.id);

    expect(result?.enrollmentId).toBe(record.enrollmentId);

    expect(result?.percentage).toBe(25);

    expect(result?.getDomainEvents()).toHaveLength(0);

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: {
        enrollmentId: record.enrollmentId,
      },
    });
  });

  it('persists newly created Progress and its domain event transactionally', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.upsert.mockResolvedValue(createPersistenceRecord() as never);

    mocks.outboxCreate.mockResolvedValue({
      id: 'outbox-1',
    });

    const repository = new PrismaProgressRepository(prisma);

    const progress = Progress.create({
      enrollmentId: 'enrollment-1',
      now: CREATED_AT,
    });

    expect(progress.getDomainEvents()).toHaveLength(0);

    progress.start(STARTED_AT);

    const pendingEvents = progress.getDomainEvents();

    expect(pendingEvents).toHaveLength(1);

    const event = pendingEvents[0];

    if (event === undefined) {
      throw new Error('Expected ProgressStarted domain event.');
    }

    expect(event.eventName).toBe('learning.progress.started');

    await repository.save(progress);

    expect(mocks.transaction).toHaveBeenCalledTimes(1);

    expect(mocks.upsert).toHaveBeenCalledTimes(1);

    expect(mocks.outboxCreate).toHaveBeenCalledTimes(1);

    const call = mocks.upsert.mock.calls[0];

    expect(call).toBeDefined();

    if (call === undefined) {
      throw new Error('Expected Progress upsert call.');
    }

    const args = call[0];

    expect(args.where).toEqual({
      id: progress.id,
    });

    expect(args.create).toMatchObject({
      id: progress.id,
      enrollmentId: progress.enrollmentId,
      status: progress.status,
      percentage: progress.percentage,
      startedAt: progress.startedAt,
      completedAt: null,
      createdAt: progress.createdAt,
      updatedAt: progress.updatedAt,
    });

    expect(args.update).toMatchObject({
      enrollmentId: progress.enrollmentId,
      status: progress.status,
      percentage: progress.percentage,
      startedAt: progress.startedAt,
      completedAt: null,
      updatedAt: progress.updatedAt,
    });

    expect(mocks.outboxCreate).toHaveBeenCalledWith({
      data: {
        eventType: event.eventName,
        aggregateType: 'Progress',
        aggregateId: progress.id,
        dedupeKey: `learning.progress:${event.eventId}`,
        payload: {
          eventId: event.eventId,
          eventName: event.eventName,
          eventVersion: event.eventVersion,
          aggregateId: event.aggregateId,
          occurredAt: event.occurredAt.toISOString(),
          payload: JSON.parse(JSON.stringify(event.payload)),
        },
        status: 'PENDING',
        attempts: 0,
        availableAt: expect.any(Date),
      },
    });

    expect(progress.getDomainEvents()).toHaveLength(0);
  });

  it('persists a lifecycle update and drains its domain event after commit', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.upsert.mockResolvedValue(
      createPersistenceRecord({
        status: ProgressStatus.IN_PROGRESS,
        percentage: 50,
        startedAt: STARTED_AT,
        updatedAt: UPDATED_AT,
      }) as never,
    );

    mocks.outboxCreate.mockResolvedValue({
      id: 'outbox-2',
    });

    const repository = new PrismaProgressRepository(prisma);

    const progress = Progress.rehydrate(createPersistenceRecord());

    progress.start(STARTED_AT);

    progress.updatePercentage(50, UPDATED_AT);

    const pendingEvents = progress.getDomainEvents();

    expect(pendingEvents).toHaveLength(2);

    await repository.save(progress);

    expect(mocks.transaction).toHaveBeenCalledTimes(1);

    expect(mocks.upsert).toHaveBeenCalledTimes(1);

    expect(mocks.outboxCreate).toHaveBeenCalledTimes(2);

    expect(progress.getDomainEvents()).toHaveLength(0);
  });

  it('persists all pending Progress domain events in one transaction', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.upsert.mockResolvedValue(
      createPersistenceRecord({
        status: ProgressStatus.COMPLETED,
        percentage: 100,
        startedAt: STARTED_AT,
        completedAt: COMPLETED_AT,
        updatedAt: COMPLETED_AT,
      }) as never,
    );

    mocks.outboxCreate.mockResolvedValue({
      id: 'outbox-event',
    });

    const repository = new PrismaProgressRepository(prisma);

    const progress = Progress.rehydrate(createPersistenceRecord());

    progress.start(STARTED_AT);

    progress.updatePercentage(100, UPDATED_AT);

    progress.complete(COMPLETED_AT);

    const pendingEvents = progress.getDomainEvents();

    expect(pendingEvents).toHaveLength(3);

    await repository.save(progress);

    expect(mocks.transaction).toHaveBeenCalledTimes(1);

    expect(mocks.upsert).toHaveBeenCalledTimes(1);

    expect(mocks.outboxCreate).toHaveBeenCalledTimes(3);

    for (const event of pendingEvents) {
      expect(mocks.outboxCreate).toHaveBeenCalledWith({
        data: {
          eventType: event.eventName,
          aggregateType: 'Progress',
          aggregateId: progress.id,
          dedupeKey: `learning.progress:${event.eventId}`,
          payload: {
            eventId: event.eventId,
            eventName: event.eventName,
            eventVersion: event.eventVersion,
            aggregateId: event.aggregateId,
            occurredAt: event.occurredAt.toISOString(),
            payload: JSON.parse(JSON.stringify(event.payload)),
          },
          status: 'PENDING',
          attempts: 0,
          availableAt: expect.any(Date),
        },
      });
    }

    expect(progress.getDomainEvents()).toHaveLength(0);
  });

  it('does not create Outbox events when saving rehydrated unchanged Progress', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.upsert.mockResolvedValue(createPersistenceRecord() as never);

    const repository = new PrismaProgressRepository(prisma);

    const progress = Progress.rehydrate(createPersistenceRecord());

    expect(progress.getDomainEvents()).toHaveLength(0);

    await repository.save(progress);

    expect(mocks.transaction).toHaveBeenCalledTimes(1);

    expect(mocks.upsert).toHaveBeenCalledTimes(1);

    expect(mocks.outboxCreate).not.toHaveBeenCalled();

    expect(progress.getDomainEvents()).toHaveLength(0);
  });

  it('keeps domain events pending when Outbox persistence fails', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.upsert.mockResolvedValue(createPersistenceRecord() as never);

    mocks.outboxCreate.mockRejectedValue({
      code: 'P2002',
      message: 'Unique constraint failed.',
    });

    const repository = new PrismaProgressRepository(prisma);

    const progress = Progress.rehydrate(createPersistenceRecord());

    progress.start(STARTED_AT);

    expect(progress.getDomainEvents()).toHaveLength(1);

    await expect(repository.save(progress)).rejects.toMatchObject({
      code: PrismaRepositoryErrorCode.UNIQUE_CONSTRAINT,
      prismaCode: 'P2002',
    });

    expect(mocks.transaction).toHaveBeenCalledTimes(1);

    expect(mocks.upsert).toHaveBeenCalledTimes(1);

    expect(mocks.outboxCreate).toHaveBeenCalledTimes(1);

    expect(progress.getDomainEvents()).toHaveLength(1);
  });

  it('maps Progress persistence unique constraint failures', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.upsert.mockRejectedValue({
      code: 'P2002',
      message: 'Unique constraint failed.',
    });

    const repository = new PrismaProgressRepository(prisma);

    const progress = Progress.rehydrate(createPersistenceRecord());

    progress.start(STARTED_AT);

    await expect(repository.save(progress)).rejects.toMatchObject({
      code: PrismaRepositoryErrorCode.UNIQUE_CONSTRAINT,
      prismaCode: 'P2002',
    });

    expect(mocks.transaction).toHaveBeenCalledTimes(1);

    expect(mocks.upsert).toHaveBeenCalledTimes(1);

    expect(mocks.outboxCreate).not.toHaveBeenCalled();

    expect(progress.getDomainEvents()).toHaveLength(1);
  });

  it('maps foreign-key failures through the repository error boundary', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.upsert.mockRejectedValue({
      code: 'P2003',
      message: 'Foreign key constraint failed.',
    });

    const repository = new PrismaProgressRepository(prisma);

    const progress = Progress.rehydrate(createPersistenceRecord());

    progress.start(STARTED_AT);

    await expect(repository.save(progress)).rejects.toMatchObject({
      code: PrismaRepositoryErrorCode.FOREIGN_KEY_CONSTRAINT,
      prismaCode: 'P2003',
    });

    expect(progress.getDomainEvents()).toHaveLength(1);
  });

  it('does not leak raw Prisma errors from findById', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.findUnique.mockRejectedValue({
      code: 'P2025',
      message: 'Record not found.',
    });

    const repository = new PrismaProgressRepository(prisma);

    await expect(
      repository.findById('missing-progress'),
    ).rejects.toBeInstanceOf(PrismaRepositoryError);

    await expect(repository.findById('missing-progress')).rejects.toMatchObject(
      {
        code: PrismaRepositoryErrorCode.RECORD_NOT_FOUND,
        prismaCode: 'P2025',
      },
    );
  });

  it('does not leak raw Prisma errors from findByEnrollmentId', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.findUnique.mockRejectedValue({
      code: 'P2025',
      message: 'Record not found.',
    });

    const repository = new PrismaProgressRepository(prisma);

    await expect(
      repository.findByEnrollmentId('missing-enrollment'),
    ).rejects.toBeInstanceOf(PrismaRepositoryError);

    await expect(
      repository.findByEnrollmentId('missing-enrollment'),
    ).rejects.toMatchObject({
      code: PrismaRepositoryErrorCode.RECORD_NOT_FOUND,
      prismaCode: 'P2025',
    });
  });
});
