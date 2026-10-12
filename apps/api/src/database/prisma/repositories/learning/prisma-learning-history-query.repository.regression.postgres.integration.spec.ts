import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  calculateLearningStreak,
  type ValidatedLearningActivityEvent,
} from '@gurusthalam/learning';

import { PrismaService } from '../../prisma.service.js';
import { PrismaLearningActivityEventRepository } from './prisma-learning-activity-event.repository.js';
import { PrismaLearningHistoryQueryRepository } from './prisma-learning-history-query.repository.js';

const TEST_NAMESPACE = `phase-5-9-d-regression-${process.pid}-${randomUUID()}`;

const DEFAULT_TENANT_ID = `${TEST_NAMESPACE}:tenant`;
const OTHER_TENANT_ID = `${TEST_NAMESPACE}:other-tenant`;

const prisma = new PrismaService();

const eventRepository = new PrismaLearningActivityEventRepository(prisma);
const historyRepository = new PrismaLearningHistoryQueryRepository(prisma);

const createdEventIds: string[] = [];

let connected = false;

interface CreateEventInput {
  readonly suffix: string;
  readonly learnerId: string;
  readonly timestamp: string;
  readonly eventType?: string;
  readonly tenantId?: string | null;
}

/**
 * Builds a fixture using the validated learning activity contract.
 *
 * tenantId:
 * - omitted: use the default test tenant;
 * - null: omit the tenant from the persisted event;
 * - string: use the supplied tenant.
 */
function createEvent(input: CreateEventInput): ValidatedLearningActivityEvent {
  const tenantId =
    input.tenantId === undefined ? DEFAULT_TENANT_ID : input.tenantId;

  return {
    eventId: `${TEST_NAMESPACE}:${input.suffix}`,
    learnerId: input.learnerId,
    eventType: input.eventType ?? 'lesson_opened',
    entityType: 'lesson',
    entityId: `${TEST_NAMESPACE}:lesson`,
    timestamp: input.timestamp,
    ...(tenantId === null ? {} : { tenantId }),
    context: {
      deviceType: 'desktop',
      platform: 'web',
      locale: 'en-IN',
      timezone: 'UTC',
    },
    metadata: {
      integrationTest: true,
      phase: '5.9-D',
    },
  };
}

async function recordEvent(input: CreateEventInput): Promise<void> {
  const event = createEvent(input);

  await eventRepository.record(event);

  // Track only successfully persisted fixtures for isolated cleanup.
  createdEventIds.push(event.eventId);
}

async function queryDays(input: {
  readonly learnerId: string;
  readonly tenantId?: string;
  readonly asOf: Date;
  readonly timezone?: string;
  readonly qualifyingEventTypes?: readonly string[];
}): Promise<readonly string[]> {
  return historyRepository.listQualifyingActivityDays({
    learnerId: input.learnerId,
    ...(input.tenantId === undefined ? {} : { tenantId: input.tenantId }),
    qualifyingEventTypes: input.qualifyingEventTypes ?? ['lesson_opened'],
    timezone: input.timezone ?? 'Asia/Kolkata',
    asOf: input.asOf,
  });
}

describe('PrismaLearningHistoryQueryRepository — PostgreSQL regression — Phase 5.9-D', () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        'DATABASE_URL is required for Learning History PostgreSQL regression tests.',
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

  it('includes the exact asOf instant and excludes an event one millisecond later', async () => {
    const learnerId = `${TEST_NAMESPACE}:as-of-boundary-learner`;

    // In Asia/Kolkata, this cutoff is 23:59:59.999 on October 12.
    const asOf = new Date('2026-10-12T18:29:59.999Z');

    await recordEvent({
      suffix: 'as-of-boundary-before',
      learnerId,
      timestamp: '2026-10-12T18:29:59.998Z',
    });

    await recordEvent({
      suffix: 'as-of-boundary-exact',
      learnerId,
      timestamp: '2026-10-12T18:29:59.999Z',
    });

    // One millisecond after the cutoff is midnight on October 13 locally.
    await recordEvent({
      suffix: 'as-of-boundary-after',
      learnerId,
      timestamp: '2026-10-12T18:30:00.000Z',
    });

    const days = await queryDays({
      learnerId,
      tenantId: DEFAULT_TENANT_ID,
      timezone: 'Asia/Kolkata',
      asOf,
    });

    expect(days).toEqual(['2026-10-12']);
  });

  it('does not include another tenant activity when tenantId is supplied', async () => {
    const learnerId = `${TEST_NAMESPACE}:tenant-isolation-learner`;

    await recordEvent({
      suffix: 'tenant-isolation-target',
      learnerId,
      tenantId: DEFAULT_TENANT_ID,
      timestamp: '2026-10-12T10:00:00.000Z',
    });

    await recordEvent({
      suffix: 'tenant-isolation-other',
      learnerId,
      tenantId: OTHER_TENANT_ID,
      timestamp: '2026-10-13T10:00:00.000Z',
    });

    const days = await queryDays({
      learnerId,
      tenantId: DEFAULT_TENANT_ID,
      timezone: 'UTC',
      asOf: new Date('2026-10-14T00:00:00.000Z'),
    });

    expect(days).toEqual(['2026-10-12']);
  });

  it('preserves optional-tenant behavior when tenantId is omitted', async () => {
    const learnerId = `${TEST_NAMESPACE}:optional-tenant-learner`;

    await recordEvent({
      suffix: 'optional-tenant-default',
      learnerId,
      tenantId: DEFAULT_TENANT_ID,
      timestamp: '2026-10-12T10:00:00.000Z',
    });

    await recordEvent({
      suffix: 'optional-tenant-other',
      learnerId,
      tenantId: OTHER_TENANT_ID,
      timestamp: '2026-10-13T10:00:00.000Z',
    });

    await recordEvent({
      suffix: 'optional-tenant-absent',
      learnerId,
      tenantId: null,
      timestamp: '2026-10-14T10:00:00.000Z',
    });

    const days = await queryDays({
      learnerId,
      timezone: 'UTC',
      asOf: new Date('2026-10-15T00:00:00.000Z'),
    });

    expect(days).toEqual(['2026-10-12', '2026-10-13', '2026-10-14']);
  });

  it('returns an empty list for a learner without qualifying history', async () => {
    const learnerId = `${TEST_NAMESPACE}:empty-history-learner`;

    const days = await queryDays({
      learnerId,
      tenantId: DEFAULT_TENANT_ID,
      timezone: 'Asia/Kolkata',
      asOf: new Date('2026-10-15T00:00:00.000Z'),
    });

    expect(days).toEqual([]);
  });

  it('matches the domain streak policy across a local-midnight boundary and asOf cutoff', async () => {
    const learnerId = `${TEST_NAMESPACE}:domain-parity-learner`;
    const timezone = 'Asia/Kolkata';
    const asOf = new Date('2026-10-12T18:29:59.999Z');
    const qualifyingEventTypes = ['lesson_opened', 'video_completed'];

    const activities = [
      {
        eventType: 'lesson_opened',
        timestamp: '2026-10-11T18:29:59.999Z',
      },
      {
        eventType: 'video_completed',
        timestamp: '2026-10-11T18:30:00.000Z',
      },
      {
        eventType: 'lesson_opened',
        timestamp: '2026-10-12T10:00:00.000Z',
      },
      {
        eventType: 'video_completed',
        timestamp: '2026-10-12T18:30:00.000Z',
      },
    ] as const;

    for (const [index, activity] of activities.entries()) {
      await recordEvent({
        suffix: `domain-parity-${index}`,
        learnerId,
        tenantId: DEFAULT_TENANT_ID,
        timestamp: activity.timestamp,
        eventType: activity.eventType,
      });
    }

    const databaseDays = await queryDays({
      learnerId,
      tenantId: DEFAULT_TENANT_ID,
      qualifyingEventTypes,
      timezone,
      asOf,
    });

    const domainResult = calculateLearningStreak({
      activities,
      qualifyingEventTypes,
      timezone,
      asOf,
      currentStreakGraceDays: 0,
    });

    expect(databaseDays).toEqual(domainResult.qualifyingActivityDays);
    expect(databaseDays).toEqual(['2026-10-11', '2026-10-12']);
  });
});
