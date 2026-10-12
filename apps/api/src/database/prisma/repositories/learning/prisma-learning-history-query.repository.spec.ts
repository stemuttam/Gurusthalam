import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma.service.js';

import { PrismaLearningHistoryQueryRepository } from './prisma-learning-history-query.repository.js';

function createRepository() {
  const queryRaw = vi.fn();

  const prisma = {
    $queryRaw: queryRaw,
  } as unknown as PrismaService;

  return {
    repository: new PrismaLearningHistoryQueryRepository(prisma),
    queryRaw,
  };
}

describe('PrismaLearningHistoryQueryRepository', () => {
  it('returns a bounded history page and a stable next cursor', async () => {
    const { repository, queryRaw } = createRepository();

    queryRaw.mockResolvedValue([
      {
        eventId: 'event-c',
        eventType: 'lesson_opened',
        entityType: 'lesson',
        entityId: 'lesson-3',
        occurredAt: new Date('2026-10-12T12:00:00.000Z'),
        sessionId: 'session-1',
        durationMs: 100,
        completionPercent: 20,
        score: null,
      },
      {
        eventId: 'event-b',
        eventType: 'video_completed',
        entityType: 'lesson',
        entityId: 'lesson-2',
        occurredAt: new Date('2026-10-12T11:00:00.000Z'),
        sessionId: null,
        durationMs: 500,
        completionPercent: 100,
        score: null,
      },
      {
        eventId: 'event-a',
        eventType: 'course_started',
        entityType: 'course',
        entityId: 'course-1',
        occurredAt: new Date('2026-10-12T10:00:00.000Z'),
        sessionId: null,
        durationMs: null,
        completionPercent: null,
        score: null,
      },
    ]);

    const result = await repository.listHistory({
      learnerId: 'learner-1',
      limit: 2,
    });

    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.eventId)).toEqual([
      'event-c',
      'event-b',
    ]);
    expect(result.nextCursor).toEqual({
      occurredAt: new Date('2026-10-12T11:00:00.000Z'),
      eventId: 'event-b',
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('returns a null cursor when there is no next page', async () => {
    const { repository, queryRaw } = createRepository();

    queryRaw.mockResolvedValue([
      {
        eventId: 'event-a',
        eventType: 'lesson_opened',
        entityType: 'lesson',
        entityId: 'lesson-1',
        occurredAt: new Date('2026-10-12T10:00:00.000Z'),
        sessionId: null,
        durationMs: null,
        completionPercent: null,
        score: null,
      },
    ]);

    const result = await repository.listHistory({
      learnerId: 'learner-1',
      limit: 2,
    });

    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });

  it('returns no qualifying days without querying PostgreSQL for an empty allowlist', async () => {
    const { repository, queryRaw } = createRepository();

    const result = await repository.listQualifyingActivityDays({
      learnerId: 'learner-1',
      qualifyingEventTypes: [],
      timezone: 'Asia/Kolkata',
      asOf: new Date('2026-10-12T12:00:00.000Z'),
    });

    expect(result).toEqual([]);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('returns distinct activity days in the database-provided order', async () => {
    const { repository, queryRaw } = createRepository();

    queryRaw.mockResolvedValue([
      { activityDay: '2026-10-10' },
      { activityDay: '2026-10-11' },
      { activityDay: '2026-10-12' },
    ]);

    await expect(
      repository.listQualifyingActivityDays({
        learnerId: 'learner-1',
        qualifyingEventTypes: ['lesson_opened', 'video_completed'],
        timezone: 'Asia/Kolkata',
        asOf: new Date('2026-10-12T12:00:00.000Z'),
      }),
    ).resolves.toEqual(['2026-10-10', '2026-10-11', '2026-10-12']);

    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('maps persistence failures through the repository error boundary', async () => {
    const { repository, queryRaw } = createRepository();

    queryRaw.mockRejectedValue({ code: 'P1001' });

    await expect(
      repository.listHistory({
        learnerId: 'learner-1',
        limit: 10,
      }),
    ).rejects.toMatchObject({
      name: 'PrismaRepositoryError',
    });
  });
});
