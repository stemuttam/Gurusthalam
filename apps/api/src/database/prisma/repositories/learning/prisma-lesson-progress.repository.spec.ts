import { describe, expect, it, vi } from 'vitest';

import {
  LessonProgress,
  LessonProgressStatus,
  type LessonProgressProps,
} from '@gurusthalam/learning';

import type { PrismaClient } from '@gurusthalam/database';

import {
  PrismaRepositoryError,
  PrismaRepositoryErrorCode,
} from '../prisma-repository.error.js';

import { PrismaLessonProgressRepository } from './prisma-lesson-progress.repository.js';

const CREATED_AT = new Date('2026-10-07T08:00:00.000Z');

const STARTED_AT = new Date('2026-10-07T08:10:00.000Z');

const UPDATED_AT = new Date('2026-10-07T08:20:00.000Z');

const COMPLETED_AT = new Date('2026-10-07T08:30:00.000Z');

function createPersistenceRecord(
  overrides: Partial<LessonProgressProps> = {},
): LessonProgressProps {
  return {
    id: 'lesson-progress-1',
    enrollmentId: 'enrollment-1',
    learningUnitId: 'learning-unit-1',
    status: LessonProgressStatus.NOT_STARTED,
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
    lessonProgress: {
      upsert: typeof upsert;
    };

    outboxEvent: {
      create: typeof outboxCreate;
    };
  };

  const transactionClient: TransactionClient = {
    lessonProgress: {
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
      lessonProgress: {
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

describe('PrismaLessonProgressRepository', () => {
  it('returns null when LessonProgress does not exist by id', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.findUnique.mockResolvedValue(null);

    const repository = new PrismaLessonProgressRepository(prisma);

    const result = await repository.findById('missing-lesson-progress');

    expect(result).toBeNull();

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'missing-lesson-progress',
      },
    });
  });

  it('returns null when LessonProgress does not exist by business identity', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.findUnique.mockResolvedValue(null);

    const repository = new PrismaLessonProgressRepository(prisma);

    const result = await repository.findByEnrollmentAndLearningUnit(
      'missing-enrollment',
      'missing-learning-unit',
    );

    expect(result).toBeNull();

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: {
        enrollmentId_learningUnitId: {
          enrollmentId: 'missing-enrollment',
          learningUnitId: 'missing-learning-unit',
        },
      },
    });
  });

  it('rehydrates LessonProgress without generating domain events', async () => {
    const { prisma, mocks } = createPrismaMock();

    const record = createPersistenceRecord({
      status: LessonProgressStatus.IN_PROGRESS,
      percentage: 45,
      startedAt: STARTED_AT,
      updatedAt: UPDATED_AT,
    });

    mocks.findUnique.mockResolvedValue(record as never);

    const repository = new PrismaLessonProgressRepository(prisma);

    const result = await repository.findById(record.id);

    expect(result).not.toBeNull();

    expect(result?.id).toBe(record.id);
    expect(result?.enrollmentId).toBe(record.enrollmentId);
    expect(result?.learningUnitId).toBe(record.learningUnitId);
    expect(result?.status).toBe(LessonProgressStatus.IN_PROGRESS);
    expect(result?.percentage).toBe(45);
    expect(result?.startedAt).toEqual(STARTED_AT);
    expect(result?.completedAt).toBeNull();
    expect(result?.getDomainEvents()).toHaveLength(0);
  });

  it('rehydrates completed LessonProgress correctly', async () => {
    const { prisma, mocks } = createPrismaMock();

    const record = createPersistenceRecord({
      status: LessonProgressStatus.COMPLETED,
      percentage: 100,
      startedAt: STARTED_AT,
      completedAt: COMPLETED_AT,
      updatedAt: COMPLETED_AT,
    });

    mocks.findUnique.mockResolvedValue(record as never);

    const repository = new PrismaLessonProgressRepository(prisma);

    const result = await repository.findById(record.id);

    expect(result?.status).toBe(LessonProgressStatus.COMPLETED);
    expect(result?.percentage).toBe(100);
    expect(result?.startedAt).toEqual(STARTED_AT);
    expect(result?.completedAt).toEqual(COMPLETED_AT);
    expect(result?.getDomainEvents()).toHaveLength(0);
  });

  it('finds LessonProgress by Enrollment and LearningUnit', async () => {
    const { prisma, mocks } = createPrismaMock();

    const record = createPersistenceRecord({
      status: LessonProgressStatus.IN_PROGRESS,
      percentage: 60,
      startedAt: STARTED_AT,
      updatedAt: UPDATED_AT,
    });

    mocks.findUnique.mockResolvedValue(record as never);

    const repository = new PrismaLessonProgressRepository(prisma);

    const result = await repository.findByEnrollmentAndLearningUnit(
      record.enrollmentId,
      record.learningUnitId,
    );

    expect(result).not.toBeNull();

    expect(result?.id).toBe(record.id);
    expect(result?.enrollmentId).toBe(record.enrollmentId);
    expect(result?.learningUnitId).toBe(record.learningUnitId);
    expect(result?.percentage).toBe(60);
    expect(result?.getDomainEvents()).toHaveLength(0);

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: {
        enrollmentId_learningUnitId: {
          enrollmentId: record.enrollmentId,
          learningUnitId: record.learningUnitId,
        },
      },
    });
  });

  it('persists newly created LessonProgress and its event transactionally', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.upsert.mockResolvedValue(
      createPersistenceRecord({
        status: LessonProgressStatus.IN_PROGRESS,
        percentage: 0,
        startedAt: STARTED_AT,
        updatedAt: STARTED_AT,
      }) as never,
    );

    mocks.outboxCreate.mockResolvedValue({
      id: 'outbox-1',
    });

    const repository = new PrismaLessonProgressRepository(prisma);

    const lessonProgress = LessonProgress.create({
      enrollmentId: 'enrollment-1',
      learningUnitId: 'learning-unit-1',
      now: CREATED_AT,
    });

    lessonProgress.start(STARTED_AT);

    const pendingEvents = lessonProgress.getDomainEvents();

    expect(pendingEvents).toHaveLength(1);

    const event = pendingEvents[0];

    if (event === undefined) {
      throw new Error('Expected LessonProgressStarted domain event.');
    }

    expect(event.eventName).toBe('learning.lesson.progress.started');

    await repository.save(lessonProgress);

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.outboxCreate).toHaveBeenCalledTimes(1);

    const call = mocks.upsert.mock.calls[0];

    if (call === undefined) {
      throw new Error('Expected LessonProgress upsert call.');
    }

    const args = call[0];

    expect(args.where).toEqual({
      id: lessonProgress.id,
    });

    expect(args.create).toMatchObject({
      id: lessonProgress.id,
      enrollmentId: lessonProgress.enrollmentId,
      learningUnitId: lessonProgress.learningUnitId,
      status: lessonProgress.status,
      percentage: lessonProgress.percentage,
      startedAt: lessonProgress.startedAt,
      completedAt: null,
      createdAt: lessonProgress.createdAt,
      updatedAt: lessonProgress.updatedAt,
    });

    expect(args.update).toMatchObject({
      enrollmentId: lessonProgress.enrollmentId,
      learningUnitId: lessonProgress.learningUnitId,
      status: lessonProgress.status,
      percentage: lessonProgress.percentage,
      startedAt: lessonProgress.startedAt,
      completedAt: null,
      updatedAt: lessonProgress.updatedAt,
    });

    expect(mocks.outboxCreate).toHaveBeenCalledWith({
      data: {
        eventType: event.eventName,
        aggregateType: 'LessonProgress',
        aggregateId: lessonProgress.id,
        dedupeKey: `learning.lesson.progress:${event.eventId}`,
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

    expect(lessonProgress.getDomainEvents()).toHaveLength(0);
  });

  it('persists multiple pending domain events in one transaction', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.upsert.mockResolvedValue(
      createPersistenceRecord({
        status: LessonProgressStatus.COMPLETED,
        percentage: 100,
        startedAt: STARTED_AT,
        completedAt: COMPLETED_AT,
        updatedAt: COMPLETED_AT,
      }) as never,
    );

    mocks.outboxCreate.mockResolvedValue({
      id: 'outbox-event',
    });

    const repository = new PrismaLessonProgressRepository(prisma);

    const lessonProgress = LessonProgress.create({
      enrollmentId: 'enrollment-1',
      learningUnitId: 'learning-unit-1',
      now: CREATED_AT,
    });

    lessonProgress.start(STARTED_AT);

    lessonProgress.updatePercentage(100, UPDATED_AT);

    lessonProgress.complete(COMPLETED_AT);

    const pendingEvents = lessonProgress.getDomainEvents();

    expect(pendingEvents).toHaveLength(3);

    await repository.save(lessonProgress);

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.outboxCreate).toHaveBeenCalledTimes(3);

    for (const event of pendingEvents) {
      expect(mocks.outboxCreate).toHaveBeenCalledWith({
        data: {
          eventType: event.eventName,
          aggregateType: 'LessonProgress',
          aggregateId: lessonProgress.id,
          dedupeKey: `learning.lesson.progress:${event.eventId}`,
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

    expect(lessonProgress.getDomainEvents()).toHaveLength(0);
  });

  it('does not create Outbox events for unchanged rehydrated LessonProgress', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.upsert.mockResolvedValue(createPersistenceRecord() as never);

    const repository = new PrismaLessonProgressRepository(prisma);

    const lessonProgress = LessonProgress.rehydrate(createPersistenceRecord());

    expect(lessonProgress.getDomainEvents()).toHaveLength(0);

    await repository.save(lessonProgress);

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.outboxCreate).not.toHaveBeenCalled();
    expect(lessonProgress.getDomainEvents()).toHaveLength(0);
  });

  it('keeps domain events pending when Outbox persistence fails', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.upsert.mockResolvedValue(
      createPersistenceRecord({
        status: LessonProgressStatus.IN_PROGRESS,
        startedAt: STARTED_AT,
        updatedAt: STARTED_AT,
      }) as never,
    );

    mocks.outboxCreate.mockRejectedValue({
      code: 'P2002',
      message: 'Unique constraint failed.',
    });

    const repository = new PrismaLessonProgressRepository(prisma);

    const lessonProgress = LessonProgress.create({
      enrollmentId: 'enrollment-1',
      learningUnitId: 'learning-unit-1',
      now: CREATED_AT,
    });

    lessonProgress.start(STARTED_AT);

    await expect(repository.save(lessonProgress)).rejects.toMatchObject({
      code: PrismaRepositoryErrorCode.UNIQUE_CONSTRAINT,
      prismaCode: 'P2002',
    });

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.outboxCreate).toHaveBeenCalledTimes(1);

    expect(lessonProgress.getDomainEvents()).toHaveLength(1);
  });

  it('maps aggregate persistence unique failures', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.upsert.mockRejectedValue({
      code: 'P2002',
      message: 'Unique constraint failed.',
    });

    const repository = new PrismaLessonProgressRepository(prisma);

    const lessonProgress = LessonProgress.create({
      enrollmentId: 'enrollment-1',
      learningUnitId: 'learning-unit-1',
      now: CREATED_AT,
    });

    await expect(repository.save(lessonProgress)).rejects.toMatchObject({
      code: PrismaRepositoryErrorCode.UNIQUE_CONSTRAINT,
      prismaCode: 'P2002',
    });

    expect(mocks.outboxCreate).not.toHaveBeenCalled();
    expect(lessonProgress.getDomainEvents()).toHaveLength(0);
  });

  it('does not leak raw Prisma errors from findById', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.findUnique.mockRejectedValue({
      code: 'P2025',
      message: 'Record not found.',
    });

    const repository = new PrismaLessonProgressRepository(prisma);

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

    const repository = new PrismaLessonProgressRepository(prisma);

    await expect(
      repository.findByEnrollmentAndLearningUnit(
        'enrollment-1',
        'learning-unit-1',
      ),
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

    const repository = new PrismaLessonProgressRepository(prisma);

    const lessonProgress = LessonProgress.create({
      enrollmentId: 'enrollment-1',
      learningUnitId: 'learning-unit-1',
      now: CREATED_AT,
    });

    lessonProgress.start(STARTED_AT);

    await expect(repository.save(lessonProgress)).rejects.toMatchObject({
      code: PrismaRepositoryErrorCode.UNIQUE_CONSTRAINT,
      prismaCode: 'P2002',
    });

    expect(lessonProgress.getDomainEvents()).toHaveLength(1);

    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.outboxCreate).not.toHaveBeenCalled();
  });
});
