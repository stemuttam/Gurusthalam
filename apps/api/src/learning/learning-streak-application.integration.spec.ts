import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  DefaultLearningStreakApplicationService,
  type ValidatedLearningActivityEvent,
} from '@gurusthalam/learning';

import { PrismaService } from '../database/prisma/prisma.service.js';
import { PrismaLearningActivityEventRepository } from '../database/prisma/repositories/learning/prisma-learning-activity-event.repository.js';
import { PrismaLearningHistoryQueryRepository } from '../database/prisma/repositories/learning/prisma-learning-history-query.repository.js';

const TEST_NAMESPACE = `phase-5-9-f-learning-streak-${process.pid}-${randomUUID()}`;

const TENANT_ID = `${TEST_NAMESPACE}:tenant`;
const LEARNER_ID = `${TEST_NAMESPACE}:learner`;
const OTHER_LEARNER_ID = `${TEST_NAMESPACE}:other-learner`;

const TIMEZONE = 'Asia/Kolkata';
const AS_OF = '2026-10-13T08:00:00.000Z';

const prisma = new PrismaService();

const activityRepository = new PrismaLearningActivityEventRepository(prisma);
const historyRepository = new PrismaLearningHistoryQueryRepository(prisma);

const service = new DefaultLearningStreakApplicationService(historyRepository);

const createdEventIds: string[] = [];

let connected = false;

interface CreateEventInput {
  readonly suffix: string;
  readonly timestamp: string;
  readonly eventType?: string;
  readonly learnerId?: string;
  readonly tenantId?: string | null;
}

/**
 * Build fixtures using the same validated activity-event contract used by
 * production persistence. Optional properties are omitted rather than set
 * to undefined or null.
 */
function createEvent(input: CreateEventInput): ValidatedLearningActivityEvent {
  const tenantId = input.tenantId === undefined ? TENANT_ID : input.tenantId;

  return {
    eventId: `${TEST_NAMESPACE}:${input.suffix}`,
    learnerId: input.learnerId ?? LEARNER_ID,
    eventType: input.eventType ?? 'quiz_completed',
    entityType: 'lesson',
    entityId: `${TEST_NAMESPACE}:lesson`,
    timestamp: input.timestamp,

    ...(tenantId === null ? {} : { tenantId }),

    context: {
      deviceType: 'desktop',
      platform: 'web',
      locale: 'en-IN',
      timezone: TIMEZONE,
    },

    metadata: {
      integrationTest: true,
    },
  };
}

async function recordEvent(input: CreateEventInput): Promise<void> {
  const event = createEvent(input);

  await activityRepository.record(event);

  // Track only successful writes so cleanup remains safe after a failure.
  createdEventIds.push(event.eventId);
}

describe('Learning Streak application — PostgreSQL integration — Phase 5.9-F', () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        'DATABASE_URL is required for Learning Streak PostgreSQL integration tests.',
      );
    }

    await prisma.$connect();
    connected = true;
  });

  afterAll(async () => {
    try {
      if (connected && createdEventIds.length > 0) {
        await prisma.learningActivityEvent.deleteMany({
          where: {
            eventId: {
              in: [...new Set(createdEventIds)],
            },
          },
        });
      }
    } finally {
      if (connected) {
        await prisma.$disconnect();
        connected = false;
      }
    }
  });

  it('calculates a consecutive streak from real persisted activity history', async () => {
    const learnerId = `${TEST_NAMESPACE}:consecutive-learner`;

    await recordEvent({
      suffix: 'consecutive-day-1',
      learnerId,
      timestamp: '2026-10-10T18:00:00.000Z',
      eventType: 'video_completed',
    });

    await recordEvent({
      suffix: 'consecutive-day-2',
      learnerId,
      timestamp: '2026-10-11T05:00:00.000Z',
      eventType: 'quiz_completed',
    });

    await recordEvent({
      suffix: 'consecutive-day-3',
      learnerId,
      timestamp: '2026-10-12T18:00:00.000Z',
      eventType: 'assignment_submitted',
    });

    // Same local day as AS_OF, but later than the exact reference instant.
    // PostgreSQL must exclude it, even though it belongs to 2026-10-13 locally.
    await recordEvent({
      suffix: 'consecutive-future-same-day',
      learnerId,
      timestamp: '2026-10-13T09:00:00.000Z',
      eventType: 'quiz_completed',
    });

    const result = await service.getLearningStreak({
      learnerId,
      tenantId: TENANT_ID,
      timezone: TIMEZONE,
      asOf: AS_OF,
    });

    expect(result).toMatchObject({
      timezone: TIMEZONE,
      asOfDate: '2026-10-13',
      qualifyingActivityDays: ['2026-10-10', '2026-10-11', '2026-10-12'],
      lastActivityDate: '2026-10-12',
      hasActivityToday: false,
      isCurrentStreakActive: true,
      currentStreakDays: 3,
      longestStreakDays: 3,
    });

    expect(result.qualifyingActivityDays).not.toContain('2026-10-13');
  });

  it('counts multiple qualifying events on one local day only once', async () => {
    const learnerId = `${TEST_NAMESPACE}:duplicate-day-learner`;

    await recordEvent({
      suffix: 'duplicate-day-video',
      learnerId,
      timestamp: '2026-10-12T04:00:00.000Z',
      eventType: 'video_completed',
    });

    await recordEvent({
      suffix: 'duplicate-day-quiz',
      learnerId,
      timestamp: '2026-10-12T05:00:00.000Z',
      eventType: 'quiz_completed',
    });

    await recordEvent({
      suffix: 'duplicate-day-assignment',
      learnerId,
      timestamp: '2026-10-12T06:00:00.000Z',
      eventType: 'assignment_submitted',
    });

    const result = await service.getLearningStreak({
      learnerId,
      tenantId: TENANT_ID,
      timezone: TIMEZONE,
      asOf: AS_OF,
    });

    expect(result.qualifyingActivityDays).toEqual(['2026-10-12']);
    expect(result.currentStreakDays).toBe(1);
    expect(result.longestStreakDays).toBe(1);
  });

  it('uses the learner-local calendar date rather than the UTC date', async () => {
    const learnerId = `${TEST_NAMESPACE}:timezone-learner`;

    // 2026-10-10T18:45Z is 2026-10-11T00:15 in Asia/Kolkata.
    await recordEvent({
      suffix: 'timezone-midnight-boundary',
      learnerId,
      timestamp: '2026-10-10T18:45:00.000Z',
      eventType: 'video_completed',
    });

    const result = await service.getLearningStreak({
      learnerId,
      tenantId: TENANT_ID,
      timezone: TIMEZONE,
      asOf: '2026-10-11T01:00:00.000Z',
    });

    expect(result.asOfDate).toBe('2026-10-11');
    expect(result.qualifyingActivityDays).toEqual(['2026-10-11']);
    expect(result.lastActivityDate).toBe('2026-10-11');
    expect(result.hasActivityToday).toBe(true);
    expect(result.currentStreakDays).toBe(1);
    expect(result.longestStreakDays).toBe(1);
  });

  it('excludes non-qualifying events from the streak', async () => {
    const learnerId = `${TEST_NAMESPACE}:non-qualifying-learner`;

    await recordEvent({
      suffix: 'non-qualifying-course-view',
      learnerId,
      timestamp: '2026-10-12T04:00:00.000Z',
      eventType: 'course_viewed',
    });

    await recordEvent({
      suffix: 'non-qualifying-recommendation-click',
      learnerId,
      timestamp: '2026-10-12T05:00:00.000Z',
      eventType: 'recommendation_clicked',
    });

    const result = await service.getLearningStreak({
      learnerId,
      tenantId: TENANT_ID,
      timezone: TIMEZONE,
      asOf: AS_OF,
    });

    expect(result.qualifyingActivityDays).toEqual([]);
    expect(result.lastActivityDate).toBeNull();
    expect(result.hasActivityToday).toBe(false);
    expect(result.isCurrentStreakActive).toBe(false);
    expect(result.currentStreakDays).toBe(0);
    expect(result.longestStreakDays).toBe(0);
  });

  it('does not include activity belonging to another learner', async () => {
    const targetLearnerId = `${TEST_NAMESPACE}:isolation-target`;
    const otherLearnerId = OTHER_LEARNER_ID;

    await recordEvent({
      suffix: 'isolation-target-activity',
      learnerId: targetLearnerId,
      timestamp: '2026-10-12T05:00:00.000Z',
      eventType: 'quiz_completed',
    });

    await recordEvent({
      suffix: 'isolation-other-activity',
      learnerId: otherLearnerId,
      timestamp: '2026-10-11T05:00:00.000Z',
      eventType: 'quiz_completed',
    });

    const result = await service.getLearningStreak({
      learnerId: targetLearnerId,
      tenantId: TENANT_ID,
      timezone: TIMEZONE,
      asOf: AS_OF,
    });

    expect(result.qualifyingActivityDays).toEqual(['2026-10-12']);
    expect(result.qualifyingActivityDays).not.toContain('2026-10-11');
    expect(result.currentStreakDays).toBe(1);
    expect(result.longestStreakDays).toBe(1);
  });

  it('preserves tenant isolation for persisted activity', async () => {
    const learnerId = `${TEST_NAMESPACE}:tenant-isolation-learner`;
    const otherTenantId = `${TEST_NAMESPACE}:other-tenant`;

    await recordEvent({
      suffix: 'tenant-isolation-target',
      learnerId,
      tenantId: TENANT_ID,
      timestamp: '2026-10-12T05:00:00.000Z',
      eventType: 'quiz_completed',
    });

    await recordEvent({
      suffix: 'tenant-isolation-other',
      learnerId,
      tenantId: otherTenantId,
      timestamp: '2026-10-11T05:00:00.000Z',
      eventType: 'quiz_completed',
    });

    const result = await service.getLearningStreak({
      learnerId,
      tenantId: TENANT_ID,
      timezone: TIMEZONE,
      asOf: AS_OF,
    });

    expect(result.qualifyingActivityDays).toEqual(['2026-10-12']);
    expect(result.qualifyingActivityDays).not.toContain('2026-10-11');
  });

  it('retains the historical longest streak when the current streak expires', async () => {
    const learnerId = `${TEST_NAMESPACE}:expired-streak-learner`;

    await recordEvent({
      suffix: 'expired-day-1',
      learnerId,
      timestamp: '2026-10-01T05:00:00.000Z',
      eventType: 'quiz_completed',
    });

    await recordEvent({
      suffix: 'expired-day-2',
      learnerId,
      timestamp: '2026-10-02T05:00:00.000Z',
      eventType: 'quiz_completed',
    });

    await recordEvent({
      suffix: 'expired-day-3',
      learnerId,
      timestamp: '2026-10-03T05:00:00.000Z',
      eventType: 'quiz_completed',
    });

    await recordEvent({
      suffix: 'expired-day-4',
      learnerId,
      timestamp: '2026-10-12T05:00:00.000Z',
      eventType: 'quiz_completed',
    });

    const result = await service.getLearningStreak({
      learnerId,
      tenantId: TENANT_ID,
      timezone: TIMEZONE,
      asOf: AS_OF,
    });

    expect(result.qualifyingActivityDays).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-12',
    ]);
    expect(result.lastActivityDate).toBe('2026-10-12');
    expect(result.isCurrentStreakActive).toBe(true);
    expect(result.currentStreakDays).toBe(1);
    expect(result.longestStreakDays).toBe(3);
  });
});
