import { describe, expect, it, vi } from 'vitest';

import {
  LearningActivityEventIdentityConflictError,
  type ValidatedLearningActivityEvent,
} from '@gurusthalam/learning';

import type { PrismaClient } from '@gurusthalam/database';

import {
  PrismaRepositoryError,
  PrismaRepositoryErrorCode,
} from '../prisma-repository.error.js';

import { PrismaLearningActivityEventRepository } from './prisma-learning-activity-event.repository.js';

const EVENT: ValidatedLearningActivityEvent = {
  eventId: 'activity-event-1',
  learnerId: 'learner-1',
  tenantId: 'tenant-1',
  sessionId: 'session-1',
  eventType: 'lesson_opened',
  entityType: 'lesson',
  entityId: 'lesson-1',
  timestamp: '2026-10-12T10:30:00.000Z',
  context: {
    deviceType: 'desktop',
    platform: 'web',
  },
  metrics: {
    durationMs: 1200,
    completionPercent: 10,
  },
  metadata: {
    source: 'course_player',
    flags: {
      resumed: false,
      autoplay: false,
    },
  },
};

function createPrismaMock() {
  const create = vi.fn();
  const findUnique = vi.fn();

  return {
    prisma: {
      learningActivityEvent: {
        create,
        findUnique,
      },
    } as unknown as PrismaClient,
    mocks: {
      create,
      findUnique,
    },
  };
}

describe('PrismaLearningActivityEventRepository', () => {
  it('persists a new activity and its complete JSON payload', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.create.mockResolvedValue({ id: 'database-id-1' });

    const repository = new PrismaLearningActivityEventRepository(prisma);

    const result = await repository.record(EVENT);

    expect(result).toEqual({ status: 'created' });
    expect(mocks.create).toHaveBeenCalledTimes(1);

    const call = mocks.create.mock.calls[0];

    expect(call).toBeDefined();

    const args = call?.[0] as {
      data: Record<string, unknown>;
    };

    expect(args.data.eventId).toBe(EVENT.eventId);
    expect(args.data.learnerId).toBe(EVENT.learnerId);
    expect(args.data.tenantId).toBe(EVENT.tenantId);
    expect(args.data.sessionId).toBe(EVENT.sessionId);
    expect(args.data.eventType).toBe(EVENT.eventType);
    expect(args.data.entityType).toBe(EVENT.entityType);
    expect(args.data.entityId).toBe(EVENT.entityId);
    expect(args.data.occurredAt).toEqual(new Date(EVENT.timestamp));
    expect(args.data.context).toEqual(EVENT.context);
    expect(args.data.metrics).toEqual(EVENT.metrics);
    expect(args.data.metadata).toEqual(EVENT.metadata);
    expect(args.data.payload).toEqual(EVENT);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it('treats an identical eventId and payload as a safe retry', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.create.mockRejectedValue({ code: 'P2002' });
    mocks.findUnique.mockResolvedValue({
      payload: {
        ...EVENT,
        context: {
          platform: 'web',
          deviceType: 'desktop',
        },
      },
    });

    const repository = new PrismaLearningActivityEventRepository(prisma);

    const result = await repository.record(EVENT);

    expect(result).toEqual({ status: 'duplicate' });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: {
        eventId: EVENT.eventId,
      },
      select: {
        payload: true,
      },
    });
  });

  it('rejects reuse of an eventId with different event content', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.create.mockRejectedValue({ code: 'P2002' });
    mocks.findUnique.mockResolvedValue({
      payload: {
        ...EVENT,
        entityId: 'different-lesson',
      },
    });

    const repository = new PrismaLearningActivityEventRepository(prisma);

    await expect(repository.record(EVENT)).rejects.toBeInstanceOf(
      LearningActivityEventIdentityConflictError,
    );
  });

  it('maps non-unique Prisma failures to the repository error contract', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.create.mockRejectedValue({
      code: 'P1001',
      message: 'Database is unavailable',
    });

    const repository = new PrismaLearningActivityEventRepository(prisma);

    await expect(repository.record(EVENT)).rejects.toMatchObject({
      name: 'PrismaRepositoryError',
      code: PrismaRepositoryErrorCode.PERSISTENCE_FAILURE,
    });

    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it('does not swallow a unique violation if the eventId cannot be found', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.create.mockRejectedValue({ code: 'P2002' });
    mocks.findUnique.mockResolvedValue(null);

    const repository = new PrismaLearningActivityEventRepository(prisma);

    await expect(repository.record(EVENT)).rejects.toBeInstanceOf(
      PrismaRepositoryError,
    );
  });

  it('maps a failed duplicate lookup through the repository error boundary', async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.create.mockRejectedValue({ code: 'P2002' });
    mocks.findUnique.mockRejectedValue({ code: 'P1001' });

    const repository = new PrismaLearningActivityEventRepository(prisma);

    await expect(repository.record(EVENT)).rejects.toMatchObject({
      name: 'PrismaRepositoryError',
      code: PrismaRepositoryErrorCode.PERSISTENCE_FAILURE,
    });
  });
});
