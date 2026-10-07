import { describe, expect, it, vi } from 'vitest';

import {
  LearningSession,
  LearningSessionStatus,
  type LearningSessionProps,
} from '@gurusthalam/learning';

import type { PrismaClient } from '@gurusthalam/database';

import {
  PrismaRepositoryError,
  PrismaRepositoryErrorCode,
} from '../prisma-repository.error.js';

import { PrismaLearningSessionRepository } from './prisma-learning-session.repository.js';

const STARTED_AT = new Date('2026-10-06T08:00:00.000Z');

const PAUSED_AT = new Date('2026-10-06T08:20:00.000Z');

const ENDED_AT = new Date('2026-10-06T08:40:00.000Z');

const CREATED_AT = new Date('2026-10-06T08:00:00.000Z');

const UPDATED_AT = new Date('2026-10-06T08:40:00.000Z');

function createPersistenceRecord(
  overrides: Partial<LearningSessionProps> = {},
): LearningSessionProps {
  return {
    id: 'learning-session-1',
    enrollmentId: 'enrollment-1',
    status: LearningSessionStatus.ACTIVE,
    startedAt: STARTED_AT,
    pausedAt: null,
    endedAt: null,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides,
  };
}

function createPrismaMock() {
  const findUnique = vi.fn();

  const upsert = vi.fn();

  const outboxCreate = vi.fn();

  type TransactionClient = {
    learningSession: {
      upsert: typeof upsert;
    };

    outboxEvent: {
      create: typeof outboxCreate;
    };
  };

  const transactionClient: TransactionClient = {
    learningSession: {
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
      learningSession: {
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

describe('PrismaLearningSessionRepository', () => {
  it('returns null when LearningSession does not exist', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.findUnique.mockResolvedValue(null);

    const repository = new PrismaLearningSessionRepository(prisma);

    const result = await repository.findById('missing-session');

    expect(result).toBeNull();

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'missing-session',
      },
    });
  });

  it('rehydrates a LearningSession without generating domain events', async () => {
    const { prisma, mocks } = createPrismaMock();

    const record = createPersistenceRecord();

    mocks.findUnique.mockResolvedValue(record as never);

    const repository = new PrismaLearningSessionRepository(prisma);

    const result = await repository.findById(record.id);

    expect(result).not.toBeNull();

    expect(result?.id).toBe(record.id);

    expect(result?.enrollmentId).toBe(record.enrollmentId);

    expect(result?.status).toBe(LearningSessionStatus.ACTIVE);

    expect(result?.startedAt).toEqual(STARTED_AT);

    expect(result?.pausedAt).toBeNull();

    expect(result?.endedAt).toBeNull();

    expect(result?.getDomainEvents()).toHaveLength(0);
  });

  it('rehydrates paused timestamps correctly', async () => {
    const { prisma, mocks } = createPrismaMock();

    const record = createPersistenceRecord({
      status: LearningSessionStatus.PAUSED,
      pausedAt: PAUSED_AT,
    });

    mocks.findUnique.mockResolvedValue(record as never);

    const repository = new PrismaLearningSessionRepository(prisma);

    const result = await repository.findById(record.id);

    expect(result?.status).toBe(LearningSessionStatus.PAUSED);

    expect(result?.pausedAt).toEqual(PAUSED_AT);

    expect(result?.endedAt).toBeNull();

    expect(result?.getDomainEvents()).toHaveLength(0);
  });

  it('rehydrates completed timestamps correctly', async () => {
    const { prisma, mocks } = createPrismaMock();

    const record = createPersistenceRecord({
      status: LearningSessionStatus.COMPLETED,
      endedAt: ENDED_AT,
      updatedAt: UPDATED_AT,
    });

    mocks.findUnique.mockResolvedValue(record as never);

    const repository = new PrismaLearningSessionRepository(prisma);

    const result = await repository.findById(record.id);

    expect(result?.status).toBe(LearningSessionStatus.COMPLETED);

    expect(result?.endedAt).toEqual(ENDED_AT);

    expect(result?.getDomainEvents()).toHaveLength(0);
  });

  it('persists a newly created LearningSession and its domain event transactionally', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.upsert.mockResolvedValue(createPersistenceRecord() as never);

    mocks.outboxCreate.mockResolvedValue({
      id: 'outbox-1',
    });

    const repository = new PrismaLearningSessionRepository(prisma);

    const session = LearningSession.create({
      enrollmentId: 'enrollment-1',
      now: STARTED_AT,
    });

    const pendingEvents = session.getDomainEvents();

    expect(pendingEvents).toHaveLength(1);

    const event = pendingEvents[0];

    if (event === undefined) {
      throw new Error('Expected LearningSession domain event.');
    }

    expect(event.eventName).toBe('learning.session.started');

    await repository.save(session);

    expect(mocks.transaction).toHaveBeenCalledTimes(1);

    expect(mocks.upsert).toHaveBeenCalledTimes(1);

    expect(mocks.outboxCreate).toHaveBeenCalledTimes(1);

    const call = mocks.upsert.mock.calls[0];

    expect(call).toBeDefined();

    if (call === undefined) {
      throw new Error('Expected LearningSession upsert call.');
    }

    const args = call[0];

    expect(args.where).toEqual({
      id: session.id,
    });

    expect(args.create).toMatchObject({
      id: session.id,
      enrollmentId: session.enrollmentId,
      status: session.status,
      startedAt: session.startedAt,
      pausedAt: null,
      endedAt: null,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    });

    expect(args.update).toMatchObject({
      enrollmentId: session.enrollmentId,
      status: session.status,
      startedAt: session.startedAt,
      pausedAt: null,
      endedAt: null,
      updatedAt: session.updatedAt,
    });

    expect(mocks.outboxCreate).toHaveBeenCalledWith({
      data: {
        eventType: event.eventName,
        aggregateType: 'LearningSession',
        aggregateId: session.id,
        dedupeKey: `learning.session:${event.eventId}`,
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

    expect(session.getDomainEvents()).toHaveLength(0);
  });

  it('persists lifecycle state and drains the domain event after commit', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.upsert.mockResolvedValue(
      createPersistenceRecord({
        status: LearningSessionStatus.PAUSED,
        pausedAt: PAUSED_AT,
      }) as never,
    );

    mocks.outboxCreate.mockResolvedValue({
      id: 'outbox-1',
    });

    const repository = new PrismaLearningSessionRepository(prisma);

    const session = LearningSession.rehydrate(createPersistenceRecord());

    session.pause(PAUSED_AT);

    expect(session.status).toBe(LearningSessionStatus.PAUSED);

    const pendingEvents = session.getDomainEvents();

    expect(pendingEvents).toHaveLength(1);

    const event = pendingEvents[0];

    if (event === undefined) {
      throw new Error('Expected LearningSession lifecycle event.');
    }

    expect(event.eventName).toBe('learning.session.paused');

    await repository.save(session);

    expect(mocks.transaction).toHaveBeenCalledTimes(1);

    expect(mocks.upsert).toHaveBeenCalledTimes(1);

    expect(mocks.outboxCreate).toHaveBeenCalledTimes(1);

    expect(mocks.outboxCreate).toHaveBeenCalledWith({
      data: {
        eventType: event.eventName,
        aggregateType: 'LearningSession',
        aggregateId: session.id,
        dedupeKey: `learning.session:${event.eventId}`,
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

    expect(session.getDomainEvents()).toHaveLength(0);
  });

  it('keeps domain events pending when the Outbox transaction fails', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.upsert.mockResolvedValue(createPersistenceRecord() as never);

    mocks.outboxCreate.mockRejectedValue({
      code: 'P2002',
      message: 'Unique constraint failed.',
    });

    const repository = new PrismaLearningSessionRepository(prisma);

    const session = LearningSession.create({
      enrollmentId: 'enrollment-1',
      now: STARTED_AT,
    });

    expect(session.getDomainEvents()).toHaveLength(1);

    await expect(repository.save(session)).rejects.toMatchObject({
      code: PrismaRepositoryErrorCode.UNIQUE_CONSTRAINT,
      prismaCode: 'P2002',
    });

    expect(mocks.transaction).toHaveBeenCalledTimes(1);

    expect(mocks.upsert).toHaveBeenCalledTimes(1);

    expect(mocks.outboxCreate).toHaveBeenCalledTimes(1);

    /*
     * The transaction failed.
     *
     * Therefore the repository MUST NOT drain the aggregate's
     * pending domain event.
     */
    expect(session.getDomainEvents()).toHaveLength(1);
  });

  it('maps PostgreSQL unique constraint failures through the repository error boundary', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.upsert.mockRejectedValue({
      code: 'P2002',
      message: 'Unique constraint failed.',
    });

    const repository = new PrismaLearningSessionRepository(prisma);

    const session = LearningSession.create({
      enrollmentId: 'enrollment-1',
      now: STARTED_AT,
    });

    await expect(repository.save(session)).rejects.toMatchObject({
      code: PrismaRepositoryErrorCode.UNIQUE_CONSTRAINT,
      prismaCode: 'P2002',
    });

    expect(mocks.transaction).toHaveBeenCalledTimes(1);

    expect(mocks.upsert).toHaveBeenCalledTimes(1);

    expect(mocks.outboxCreate).not.toHaveBeenCalled();

    expect(session.getDomainEvents()).toHaveLength(1);
  });

  it('does not leak raw Prisma errors', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.findUnique.mockRejectedValue({
      code: 'P2025',
      message: 'Record not found.',
    });

    const repository = new PrismaLearningSessionRepository(prisma);

    await expect(
      repository.findById('missing-session'),
    ).rejects.toBeInstanceOf(PrismaRepositoryError);

    await expect(repository.findById('missing-session')).rejects.toMatchObject({
      code: PrismaRepositoryErrorCode.RECORD_NOT_FOUND,
      prismaCode: 'P2025',
    });
  });
});