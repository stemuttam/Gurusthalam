import { describe, expect, it, vi } from 'vitest';

import {
  SectionProgress,
  SectionProgressStatus,
  type SectionProgressProps,
} from '@gurusthalam/learning';

import type { PrismaClient } from '@gurusthalam/database';

import {
  PrismaRepositoryError,
  PrismaRepositoryErrorCode,
} from '../prisma-repository.error.js';

import { PrismaSectionProgressRepository } from './prisma-section-progress.repository.js';

const CREATED_AT = new Date('2026-10-07T08:00:00.000Z');
const STARTED_AT = new Date('2026-10-07T08:10:00.000Z');
const UPDATED_AT = new Date('2026-10-07T08:20:00.000Z');
const COMPLETED_AT = new Date('2026-10-07T08:30:00.000Z');

function createPersistenceRecord(
  overrides: Partial<SectionProgressProps> = {},
): SectionProgressProps {
  return {
    id: 'section-progress-1',
    enrollmentId: 'enrollment-1',
    sectionId: 'section-1',
    status: SectionProgressStatus.NOT_STARTED,
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
    sectionProgress: { upsert: typeof upsert };
    outboxEvent: { create: typeof outboxCreate };
  };

  const transactionClient: TransactionClient = {
    sectionProgress: { upsert },
    outboxEvent: { create: outboxCreate },
  };

  const transaction = vi.fn(
    async (
      callback: (transactionClient: TransactionClient) => Promise<void>,
    ): Promise<void> => callback(transactionClient),
  );

  return {
    prisma: {
      sectionProgress: { findUnique },
      $transaction: transaction,
    } as unknown as PrismaClient,
    mocks: { findUnique, upsert, outboxCreate, transaction },
  };
}

describe('PrismaSectionProgressRepository', () => {
  it('returns null when SectionProgress does not exist by id', async () => {
    const { prisma, mocks } = createPrismaMock();
    mocks.findUnique.mockResolvedValue(null);

    const repository = new PrismaSectionProgressRepository(prisma);
    const result = await repository.findById('missing-section-progress');

    expect(result).toBeNull();
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: 'missing-section-progress' },
    });
  });

  it('returns null when SectionProgress does not exist by business identity', async () => {
    const { prisma, mocks } = createPrismaMock();
    mocks.findUnique.mockResolvedValue(null);

    const repository = new PrismaSectionProgressRepository(prisma);
    const result = await repository.findByEnrollmentAndSection(
      'missing-enrollment',
      'missing-section',
    );

    expect(result).toBeNull();
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: {
        enrollmentId_sectionId: {
          enrollmentId: 'missing-enrollment',
          sectionId: 'missing-section',
        },
      },
    });
  });

  it('rehydrates IN_PROGRESS state without generating domain events', async () => {
    const { prisma, mocks } = createPrismaMock();
    const record = createPersistenceRecord({
      status: SectionProgressStatus.IN_PROGRESS,
      percentage: 45,
      startedAt: STARTED_AT,
      updatedAt: UPDATED_AT,
    });
    mocks.findUnique.mockResolvedValue(record as never);

    const repository = new PrismaSectionProgressRepository(prisma);
    const result = await repository.findById(record.id);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(record.id);
    expect(result?.enrollmentId).toBe(record.enrollmentId);
    expect(result?.sectionId).toBe(record.sectionId);
    expect(result?.status).toBe(SectionProgressStatus.IN_PROGRESS);
    expect(result?.percentage).toBe(45);
    expect(result?.startedAt).toEqual(STARTED_AT);
    expect(result?.completedAt).toBeNull();
    expect(result?.getDomainEvents()).toHaveLength(0);
  });

  it('rehydrates COMPLETED state correctly', async () => {
    const { prisma, mocks } = createPrismaMock();
    const record = createPersistenceRecord({
      status: SectionProgressStatus.COMPLETED,
      percentage: 100,
      startedAt: STARTED_AT,
      completedAt: COMPLETED_AT,
      updatedAt: COMPLETED_AT,
    });
    mocks.findUnique.mockResolvedValue(record as never);

    const repository = new PrismaSectionProgressRepository(prisma);
    const result = await repository.findById(record.id);

    expect(result?.status).toBe(SectionProgressStatus.COMPLETED);
    expect(result?.percentage).toBe(100);
    expect(result?.startedAt).toEqual(STARTED_AT);
    expect(result?.completedAt).toEqual(COMPLETED_AT);
    expect(result?.getDomainEvents()).toHaveLength(0);
  });

  it('finds SectionProgress by Enrollment and Section', async () => {
    const { prisma, mocks } = createPrismaMock();
    const record = createPersistenceRecord({
      status: SectionProgressStatus.IN_PROGRESS,
      percentage: 60,
      startedAt: STARTED_AT,
      updatedAt: UPDATED_AT,
    });
    mocks.findUnique.mockResolvedValue(record as never);

    const repository = new PrismaSectionProgressRepository(prisma);
    const result = await repository.findByEnrollmentAndSection(
      record.enrollmentId,
      record.sectionId,
    );

    expect(result).not.toBeNull();
    expect(result?.id).toBe(record.id);
    expect(result?.enrollmentId).toBe(record.enrollmentId);
    expect(result?.sectionId).toBe(record.sectionId);
    expect(result?.percentage).toBe(60);
    expect(result?.getDomainEvents()).toHaveLength(0);
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: {
        enrollmentId_sectionId: {
          enrollmentId: record.enrollmentId,
          sectionId: record.sectionId,
        },
      },
    });
  });

  it('persists a new SectionProgress and its event transactionally', async () => {
    const { prisma, mocks } = createPrismaMock();
    mocks.upsert.mockResolvedValue(
      createPersistenceRecord({
        status: SectionProgressStatus.IN_PROGRESS,
        startedAt: STARTED_AT,
        updatedAt: STARTED_AT,
      }) as never,
    );
    mocks.outboxCreate.mockResolvedValue({ id: 'outbox-1' });

    const repository = new PrismaSectionProgressRepository(prisma);
    const sectionProgress = SectionProgress.create({
      enrollmentId: 'enrollment-1',
      sectionId: 'section-1',
      now: CREATED_AT,
    });
    sectionProgress.start(STARTED_AT);
    const pendingEvents = sectionProgress.getDomainEvents();
    expect(pendingEvents).toHaveLength(1);

    const event = pendingEvents[0];
    if (event === undefined) {
      throw new Error('Expected SectionProgressStarted domain event.');
    }
    expect(event.eventName).toBe('learning.section.progress.started');

    await repository.save(sectionProgress);

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.outboxCreate).toHaveBeenCalledTimes(1);

    const call = mocks.upsert.mock.calls[0];
    if (call === undefined) {
      throw new Error('Expected SectionProgress upsert call.');
    }
    const args = call[0];
    expect(args.where).toEqual({ id: sectionProgress.id });
    expect(args.create).toMatchObject({
      id: sectionProgress.id,
      enrollmentId: sectionProgress.enrollmentId,
      sectionId: sectionProgress.sectionId,
      status: sectionProgress.status,
      percentage: sectionProgress.percentage,
      startedAt: sectionProgress.startedAt,
      completedAt: null,
      createdAt: sectionProgress.createdAt,
      updatedAt: sectionProgress.updatedAt,
    });
    expect(args.update).toMatchObject({
      enrollmentId: sectionProgress.enrollmentId,
      sectionId: sectionProgress.sectionId,
      status: sectionProgress.status,
      percentage: sectionProgress.percentage,
      startedAt: sectionProgress.startedAt,
      completedAt: null,
      updatedAt: sectionProgress.updatedAt,
    });
    expect(mocks.outboxCreate).toHaveBeenCalledWith({
      data: {
        eventType: event.eventName,
        aggregateType: 'SectionProgress',
        aggregateId: sectionProgress.id,
        dedupeKey: `learning.section.progress:${event.eventId}`,
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
    expect(sectionProgress.getDomainEvents()).toHaveLength(0);
  });

  it('persists all pending domain events in one transaction', async () => {
    const { prisma, mocks } = createPrismaMock();
    mocks.upsert.mockResolvedValue(
      createPersistenceRecord({
        status: SectionProgressStatus.COMPLETED,
        percentage: 100,
        startedAt: STARTED_AT,
        completedAt: COMPLETED_AT,
        updatedAt: COMPLETED_AT,
      }) as never,
    );
    mocks.outboxCreate.mockResolvedValue({ id: 'outbox-event' });

    const repository = new PrismaSectionProgressRepository(prisma);
    const sectionProgress = SectionProgress.create({
      enrollmentId: 'enrollment-1',
      sectionId: 'section-1',
      now: CREATED_AT,
    });
    sectionProgress.start(STARTED_AT);
    sectionProgress.updatePercentage(100, UPDATED_AT);
    sectionProgress.complete(COMPLETED_AT);
    const pendingEvents = sectionProgress.getDomainEvents();
    expect(pendingEvents).toHaveLength(3);

    await repository.save(sectionProgress);

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.outboxCreate).toHaveBeenCalledTimes(3);
    for (const event of pendingEvents) {
      expect(mocks.outboxCreate).toHaveBeenCalledWith({
        data: {
          eventType: event.eventName,
          aggregateType: 'SectionProgress',
          aggregateId: sectionProgress.id,
          dedupeKey: `learning.section.progress:${event.eventId}`,
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
    expect(sectionProgress.getDomainEvents()).toHaveLength(0);
  });

  it('does not create Outbox events for unchanged rehydrated SectionProgress', async () => {
    const { prisma, mocks } = createPrismaMock();
    mocks.upsert.mockResolvedValue(createPersistenceRecord() as never);

    const repository = new PrismaSectionProgressRepository(prisma);
    const sectionProgress = SectionProgress.rehydrate(
      createPersistenceRecord(),
    );
    expect(sectionProgress.getDomainEvents()).toHaveLength(0);

    await repository.save(sectionProgress);

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.outboxCreate).not.toHaveBeenCalled();
    expect(sectionProgress.getDomainEvents()).toHaveLength(0);
  });

  it('keeps domain events pending when Outbox persistence fails', async () => {
    const { prisma, mocks } = createPrismaMock();
    mocks.upsert.mockResolvedValue(
      createPersistenceRecord({
        status: SectionProgressStatus.IN_PROGRESS,
        startedAt: STARTED_AT,
        updatedAt: STARTED_AT,
      }) as never,
    );
    mocks.outboxCreate.mockRejectedValue({
      code: 'P2002',
      message: 'Unique constraint failed.',
    });

    const repository = new PrismaSectionProgressRepository(prisma);
    const sectionProgress = SectionProgress.create({
      enrollmentId: 'enrollment-1',
      sectionId: 'section-1',
      now: CREATED_AT,
    });
    sectionProgress.start(STARTED_AT);

    await expect(repository.save(sectionProgress)).rejects.toMatchObject({
      code: PrismaRepositoryErrorCode.UNIQUE_CONSTRAINT,
      prismaCode: 'P2002',
    });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.outboxCreate).toHaveBeenCalledTimes(1);
    expect(sectionProgress.getDomainEvents()).toHaveLength(1);
  });

  it('maps aggregate persistence unique failures', async () => {
    const { prisma, mocks } = createPrismaMock();
    mocks.upsert.mockRejectedValue({
      code: 'P2002',
      message: 'Unique constraint failed.',
    });

    const repository = new PrismaSectionProgressRepository(prisma);
    const sectionProgress = SectionProgress.create({
      enrollmentId: 'enrollment-1',
      sectionId: 'section-1',
      now: CREATED_AT,
    });

    await expect(repository.save(sectionProgress)).rejects.toMatchObject({
      code: PrismaRepositoryErrorCode.UNIQUE_CONSTRAINT,
      prismaCode: 'P2002',
    });
    expect(mocks.outboxCreate).not.toHaveBeenCalled();
    expect(sectionProgress.getDomainEvents()).toHaveLength(0);
  });

  it('does not leak raw Prisma errors from findById', async () => {
    const { prisma, mocks } = createPrismaMock();
    mocks.findUnique.mockRejectedValue({
      code: 'P2025',
      message: 'Record not found.',
    });

    const repository = new PrismaSectionProgressRepository(prisma);
    await expect(repository.findById('missing')).rejects.toBeInstanceOf(
      PrismaRepositoryError,
    );
    await expect(repository.findById('missing')).rejects.toMatchObject({
      code: PrismaRepositoryErrorCode.RECORD_NOT_FOUND,
      prismaCode: 'P2025',
    });
  });

  it('does not leak raw Prisma errors from business-identity lookup', async () => {
    const { prisma, mocks } = createPrismaMock();
    mocks.findUnique.mockRejectedValue({
      code: 'P2025',
      message: 'Record not found.',
    });

    const repository = new PrismaSectionProgressRepository(prisma);
    await expect(
      repository.findByEnrollmentAndSection('enrollment-1', 'section-1'),
    ).rejects.toMatchObject({
      code: PrismaRepositoryErrorCode.RECORD_NOT_FOUND,
      prismaCode: 'P2025',
    });
  });

  it('keeps domain events pending when the transaction fails', async () => {
    const { prisma, mocks } = createPrismaMock();
    mocks.transaction.mockRejectedValue({
      code: 'P2002',
      message: 'Unique constraint failed.',
    });

    const repository = new PrismaSectionProgressRepository(prisma);
    const sectionProgress = SectionProgress.create({
      enrollmentId: 'enrollment-1',
      sectionId: 'section-1',
      now: CREATED_AT,
    });
    sectionProgress.start(STARTED_AT);

    await expect(repository.save(sectionProgress)).rejects.toMatchObject({
      code: PrismaRepositoryErrorCode.UNIQUE_CONSTRAINT,
      prismaCode: 'P2002',
    });
    expect(sectionProgress.getDomainEvents()).toHaveLength(1);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.outboxCreate).not.toHaveBeenCalled();
  });
});
