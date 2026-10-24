import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  DefaultLearningStreakApplicationService,
  LearningActivityEventName,
  learningActivityEventSchema,
  type ValidatedLearningActivityEvent,
} from '@gurusthalam/learning';

import { PrismaService } from '../database/prisma/prisma.service.js';
import { PrismaLearningActivityEventRepository } from '../database/prisma/repositories/learning/prisma-learning-activity-event.repository.js';
import { PrismaLearningHistoryQueryRepository } from '../database/prisma/repositories/learning/prisma-learning-history-query.repository.js';

describe('Learning streak application - PostgreSQL integration', () => {
  const prisma = new PrismaService();

  const eventRepository = new PrismaLearningActivityEventRepository(prisma);
  const historyRepository = new PrismaLearningHistoryQueryRepository(prisma);
  const streakService = new DefaultLearningStreakApplicationService(
    historyRepository,
  );

  const testPrefix = `phase-5-9-f-${randomUUID()}`;
  const createdEventIds: string[] = [];

  beforeAll(async () => {
    await prisma.onModuleInit();
  });

  afterEach(async () => {
    if (createdEventIds.length === 0) {
      return;
    }

    await prisma.learningActivityEvent.deleteMany({
      where: {
        eventId: {
          in: [...createdEventIds],
        },
      },
    });

    createdEventIds.length = 0;
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  async function recordActivity(input: {
    readonly suffix: string;
    readonly learnerId: string;
    readonly tenantId?: string;
    readonly eventType: string;
    readonly timestamp: string;
  }): Promise<void> {
    const eventId = `${testPrefix}-${input.suffix}`;

    // Track only test-owned identities so cleanup cannot claim unrelated rows.
    createdEventIds.push(eventId);

    const event = learningActivityEventSchema.parse({
      eventId,
      learnerId: input.learnerId,
      ...(input.tenantId === undefined ? {} : { tenantId: input.tenantId }),
      eventType: input.eventType,
      entityType: 'lesson',
      entityId: `${testPrefix}-lesson-${input.suffix}`,
      timestamp: input.timestamp,
      context: {
        platform: 'integration-test',
        timezone: 'UTC',
      },
    }) satisfies ValidatedLearningActivityEvent;

    await eventRepository.record(event);
  }

  it('derives a streak from persisted qualifying events and deduplicates local days', async () => {
    const learnerId = `${testPrefix}-learner`;
    const tenantId = `${testPrefix}-tenant`;
    const asOf = '2026-10-13T08:00:00.000Z';

    await recordActivity({
      suffix: 'nonqualifying-passive',
      learnerId,
      tenantId,
      eventType: LearningActivityEventName.LESSON_OPENED,
      timestamp: '2026-10-09T06:00:00.000Z',
    });

    await recordActivity({
      suffix: 'qualifying-day-10',
      learnerId,
      tenantId,
      eventType: LearningActivityEventName.VIDEO_COMPLETED,
      timestamp: '2026-10-10T06:00:00.000Z',
    });

    await recordActivity({
      suffix: 'qualifying-day-11-a',
      learnerId,
      tenantId,
      eventType: LearningActivityEventName.QUESTION_ANSWERED,
      timestamp: '2026-10-11T06:00:00.000Z',
    });

    // A second qualifying event on the same learner-local day counts once.
    await recordActivity({
      suffix: 'qualifying-day-11-b',
      learnerId,
      tenantId,
      eventType: LearningActivityEventName.QUIZ_COMPLETED,
      timestamp: '2026-10-11T07:00:00.000Z',
    });

    await recordActivity({
      suffix: 'qualifying-day-12',
      learnerId,
      tenantId,
      eventType: LearningActivityEventName.ASSIGNMENT_SUBMITTED,
      timestamp: '2026-10-12T06:00:00.000Z',
    });

    // Same local date as asOf, but after the exact reference instant.
    await recordActivity({
      suffix: 'after-as-of',
      learnerId,
      tenantId,
      eventType: LearningActivityEventName.VIDEO_COMPLETED,
      timestamp: '2026-10-13T09:00:00.000Z',
    });

    const result = await streakService.getLearningStreak({
      learnerId,
      tenantId,
      timezone: 'Asia/Kolkata',
      asOf,
    });

    expect(result).toMatchObject({
      timezone: 'Asia/Kolkata',
      asOfDate: '2026-10-13',
      qualifyingActivityDays: ['2026-10-10', '2026-10-11', '2026-10-12'],
      lastActivityDate: '2026-10-12',
      hasActivityToday: false,
      isCurrentStreakActive: true,
      currentStreakDays: 3,
      longestStreakDays: 3,
    });
  });

  it('includes an event exactly at asOf and excludes an event one millisecond later', async () => {
    const learnerId = `${testPrefix}-cutoff-learner`;
    const asOf = '2026-10-12T23:59:59.999Z';

    await recordActivity({
      suffix: 'cutoff-equal',
      learnerId,
      eventType: LearningActivityEventName.VIDEO_COMPLETED,
      timestamp: asOf,
    });

    await recordActivity({
      suffix: 'cutoff-plus-one-ms',
      learnerId,
      eventType: LearningActivityEventName.QUESTION_ANSWERED,
      timestamp: '2026-10-13T00:00:00.000Z',
    });

    const result = await streakService.getLearningStreak({
      learnerId,
      timezone: 'UTC',
      asOf,
    });

    expect(result.asOfDate).toBe('2026-10-12');
    expect(result.qualifyingActivityDays).toEqual(['2026-10-12']);
    expect(result.lastActivityDate).toBe('2026-10-12');
    expect(result.hasActivityToday).toBe(true);
  });

  it('derives local days correctly across UTC midnight and the New York daylight-saving transition', async () => {
    const learnerId = `${testPrefix}-dst-learner`;

    await recordActivity({
      suffix: 'dst-before-midnight',
      learnerId,
      eventType: LearningActivityEventName.VIDEO_COMPLETED,
      timestamp: '2026-03-08T04:59:59.999Z',
    });

    await recordActivity({
      suffix: 'dst-midnight',
      learnerId,
      eventType: LearningActivityEventName.QUESTION_ANSWERED,
      timestamp: '2026-03-08T05:00:00.000Z',
    });

    // New York advances from 01:59:59 to 03:00:00 on this date.
    await recordActivity({
      suffix: 'dst-after-jump',
      learnerId,
      eventType: LearningActivityEventName.QUIZ_COMPLETED,
      timestamp: '2026-03-08T07:00:00.000Z',
    });

    const result = await streakService.getLearningStreak({
      learnerId,
      timezone: 'America/New_York',
      asOf: '2026-03-08T12:00:00.000Z',
    });

    expect(result).toMatchObject({
      timezone: 'America/New_York',
      asOfDate: '2026-03-08',
      qualifyingActivityDays: ['2026-03-07', '2026-03-08'],
      lastActivityDate: '2026-03-08',
      hasActivityToday: true,
    });
  });

  it('isolates tenant-scoped results and documents tenant-omitted behavior', async () => {
    const learnerId = `${testPrefix}-tenant-learner`;
    const tenantA = `${testPrefix}-tenant-a`;
    const tenantB = `${testPrefix}-tenant-b`;

    await recordActivity({
      suffix: 'tenant-a-day',
      learnerId,
      tenantId: tenantA,
      eventType: LearningActivityEventName.VIDEO_COMPLETED,
      timestamp: '2026-10-10T12:00:00.000Z',
    });

    await recordActivity({
      suffix: 'tenant-b-day',
      learnerId,
      tenantId: tenantB,
      eventType: LearningActivityEventName.QUESTION_ANSWERED,
      timestamp: '2026-10-11T12:00:00.000Z',
    });

    const tenantScoped = await streakService.getLearningStreak({
      learnerId,
      tenantId: tenantA,
      timezone: 'UTC',
      asOf: '2026-10-12T23:00:00.000Z',
    });

    expect(tenantScoped.qualifyingActivityDays).toEqual(['2026-10-10']);

    // The established repository contract omits the tenant predicate when
    // tenantId is absent. Callers must still enforce authorization upstream.
    const tenantOmitted = await streakService.getLearningStreak({
      learnerId,
      timezone: 'UTC',
      asOf: '2026-10-12T23:00:00.000Z',
    });

    expect(tenantOmitted.qualifyingActivityDays).toEqual([
      '2026-10-10',
      '2026-10-11',
    ]);
  });

  it('returns a zero streak for a learner with no persisted activity', async () => {
    const result = await streakService.getLearningStreak({
      learnerId: `${testPrefix}-empty-learner`,
      timezone: 'UTC',
      asOf: '2026-10-12T12:00:00.000Z',
    });

    expect(result).toMatchObject({
      timezone: 'UTC',
      asOfDate: '2026-10-12',
      qualifyingActivityDays: [],
      lastActivityDate: null,
      hasActivityToday: false,
      isCurrentStreakActive: false,
      currentStreakDays: 0,
      longestStreakDays: 0,
    });
  });
});
