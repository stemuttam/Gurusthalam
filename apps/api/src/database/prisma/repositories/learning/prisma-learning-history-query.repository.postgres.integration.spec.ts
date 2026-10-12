import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { ValidatedLearningActivityEvent } from '@gurusthalam/learning';

import { PrismaService } from '../../prisma.service.js';
import { PrismaLearningActivityEventRepository } from './prisma-learning-activity-event.repository.js';
import { PrismaLearningHistoryQueryRepository } from './prisma-learning-history-query.repository.js';

const TEST_NAMESPACE = `phase-5-9-c-history-query-${process.pid}-${randomUUID()}`;

const LEARNER_ID = `${TEST_NAMESPACE}:learner`;
const OTHER_LEARNER_ID = `${TEST_NAMESPACE}:other-learner`;
const TENANT_ID = `${TEST_NAMESPACE}:tenant`;
const OTHER_TENANT_ID = `${TEST_NAMESPACE}:other-tenant`;

const prisma = new PrismaService();

const eventRepository = new PrismaLearningActivityEventRepository(prisma);
const historyRepository = new PrismaLearningHistoryQueryRepository(prisma);

const createdEventIds: string[] = [];

let connected = false;

interface CreateEventInput {
  readonly suffix: string;
  readonly learnerId?: string;
  readonly tenantId?: string | null;
  readonly eventType?: string;
  readonly entityId?: string;
  readonly timestamp: string;
  readonly sessionId?: string | null;
  readonly metrics?: Record<string, number>;
}

/**
 * Creates a validated activity-event fixture using only fields accepted by
 * the learning activity validation contract.
 *
 * A null tenantId or sessionId means that the optional field is omitted.
 * Undefined tenantId selects the default test tenant; undefined sessionId
 * selects the default test session.
 */
function createEvent(input: CreateEventInput): ValidatedLearningActivityEvent {
  const eventId = `${TEST_NAMESPACE}:${input.suffix}`;

  const tenantId = input.tenantId === undefined ? TENANT_ID : input.tenantId;

  const sessionId =
    input.sessionId === undefined
      ? `${TEST_NAMESPACE}:session`
      : input.sessionId;

  return {
    eventId,
    learnerId: input.learnerId ?? LEARNER_ID,
    eventType: input.eventType ?? 'lesson_opened',
    entityType: 'lesson',
    entityId: input.entityId ?? `${TEST_NAMESPACE}:lesson`,
    timestamp: input.timestamp,

    // Optional validated fields must be omitted rather than assigned null.
    ...(tenantId === null ? {} : { tenantId }),
    ...(sessionId === null ? {} : { sessionId }),

    // Use only properties supported by the activity context schema.
    context: {
      deviceType: 'desktop',
      platform: 'web',
      locale: 'en-IN',
      timezone: 'UTC',
    },

    ...(input.metrics === undefined ? {} : { metrics: input.metrics }),

    metadata: {
      integrationTest: true,
    },
  };
}

async function recordEvent(input: CreateEventInput): Promise<void> {
  const event = createEvent(input);

  await eventRepository.record(event);

  // Track only successfully persisted fixtures for isolated cleanup.
  createdEventIds.push(event.eventId);
}

describe('PrismaLearningHistoryQueryRepository — PostgreSQL integration — Phase 5.9-C', () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        'DATABASE_URL is required for Learning History PostgreSQL integration tests.',
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

  it('returns only the requested learner activity and maps persisted metrics', async () => {
    const occurredAt = '2026-10-12T10:30:00.000Z';

    await recordEvent({
      suffix: 'learner-scope-target',
      timestamp: occurredAt,
      metrics: {
        durationMs: 1250,
        completionPercent: 75,
        score: 92,
      },
    });

    await recordEvent({
      suffix: 'learner-scope-other-learner',
      learnerId: OTHER_LEARNER_ID,
      timestamp: occurredAt,
    });

    const result = await historyRepository.listHistory({
      learnerId: LEARNER_ID,
      tenantId: TENANT_ID,
      limit: 20,
    });

    const matching = result.items.find(
      (item) => item.eventId === `${TEST_NAMESPACE}:learner-scope-target`,
    );

    expect(matching).toMatchObject({
      eventId: `${TEST_NAMESPACE}:learner-scope-target`,
      eventType: 'lesson_opened',
      entityType: 'lesson',
      occurredAt: new Date(occurredAt),
      durationMs: 1250,
      completionPercent: 75,
      score: 92,
    });

    expect(
      result.items.some(
        (item) =>
          item.eventId === `${TEST_NAMESPACE}:learner-scope-other-learner`,
      ),
    ).toBe(false);
  });

  it('scopes activity to the requested tenant when tenantId is supplied', async () => {
    await recordEvent({
      suffix: 'tenant-scope-match',
      tenantId: TENANT_ID,
      timestamp: '2026-10-12T11:00:00.000Z',
    });

    await recordEvent({
      suffix: 'tenant-scope-other',
      tenantId: OTHER_TENANT_ID,
      timestamp: '2026-10-12T11:01:00.000Z',
    });

    const result = await historyRepository.listHistory({
      learnerId: LEARNER_ID,
      tenantId: TENANT_ID,
      limit: 100,
    });

    const ids = result.items.map((item) => item.eventId);

    expect(ids).toContain(`${TEST_NAMESPACE}:tenant-scope-match`);
    expect(ids).not.toContain(`${TEST_NAMESPACE}:tenant-scope-other`);
  });

  it('uses eventId as a deterministic tie-breaker for equal timestamps', async () => {
    const timestamp = '2026-10-12T12:00:00.000Z';

    await recordEvent({ suffix: 'tie-a', timestamp });
    await recordEvent({ suffix: 'tie-b', timestamp });
    await recordEvent({ suffix: 'tie-c', timestamp });

    const result = await historyRepository.listHistory({
      learnerId: LEARNER_ID,
      tenantId: TENANT_ID,
      from: new Date(timestamp),
      to: new Date(timestamp),
      limit: 10,
    });

    const ids = result.items
      .filter((item) =>
        [
          `${TEST_NAMESPACE}:tie-a`,
          `${TEST_NAMESPACE}:tie-b`,
          `${TEST_NAMESPACE}:tie-c`,
        ].includes(item.eventId),
      )
      .map((item) => item.eventId);

    expect(ids).toEqual([
      `${TEST_NAMESPACE}:tie-c`,
      `${TEST_NAMESPACE}:tie-b`,
      `${TEST_NAMESPACE}:tie-a`,
    ]);
  });

  it('paginates equal-timestamp rows without duplicates or omissions', async () => {
    const timestamp = '2026-10-12T13:00:00.000Z';

    await recordEvent({ suffix: 'page-a', timestamp });
    await recordEvent({ suffix: 'page-b', timestamp });
    await recordEvent({ suffix: 'page-c', timestamp });
    await recordEvent({ suffix: 'page-d', timestamp });

    const firstPage = await historyRepository.listHistory({
      learnerId: LEARNER_ID,
      tenantId: TENANT_ID,
      from: new Date(timestamp),
      to: new Date(timestamp),
      limit: 2,
    });

    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.nextCursor).not.toBeNull();

    const cursor = firstPage.nextCursor;

    if (cursor === null) {
      throw new Error('Expected a next cursor for the first history page.');
    }

    const secondPage = await historyRepository.listHistory({
      learnerId: LEARNER_ID,
      tenantId: TENANT_ID,
      from: new Date(timestamp),
      to: new Date(timestamp),
      cursor,
      limit: 2,
    });

    expect(secondPage.items).toHaveLength(2);
    expect(secondPage.nextCursor).toBeNull();

    const allIds = [
      ...firstPage.items.map((item) => item.eventId),
      ...secondPage.items.map((item) => item.eventId),
    ];

    expect(allIds).toEqual([
      `${TEST_NAMESPACE}:page-d`,
      `${TEST_NAMESPACE}:page-c`,
      `${TEST_NAMESPACE}:page-b`,
      `${TEST_NAMESPACE}:page-a`,
    ]);

    expect(new Set(allIds).size).toBe(4);
  });

  it('applies inclusive from and to bounds', async () => {
    await recordEvent({
      suffix: 'range-before',
      timestamp: '2026-10-12T09:59:59.999Z',
    });

    await recordEvent({
      suffix: 'range-from',
      timestamp: '2026-10-12T10:00:00.000Z',
    });

    await recordEvent({
      suffix: 'range-middle',
      timestamp: '2026-10-12T10:30:00.000Z',
    });

    await recordEvent({
      suffix: 'range-to',
      timestamp: '2026-10-12T11:00:00.000Z',
    });

    await recordEvent({
      suffix: 'range-after',
      timestamp: '2026-10-12T11:00:00.001Z',
    });

    const result = await historyRepository.listHistory({
      learnerId: LEARNER_ID,
      tenantId: TENANT_ID,
      from: new Date('2026-10-12T10:00:00.000Z'),
      to: new Date('2026-10-12T11:00:00.000Z'),
      limit: 100,
    });

    const ids = result.items.map((item) => item.eventId);

    expect(ids).toContain(`${TEST_NAMESPACE}:range-from`);
    expect(ids).toContain(`${TEST_NAMESPACE}:range-middle`);
    expect(ids).toContain(`${TEST_NAMESPACE}:range-to`);

    expect(ids).not.toContain(`${TEST_NAMESPACE}:range-before`);
    expect(ids).not.toContain(`${TEST_NAMESPACE}:range-after`);
  });

  it('returns qualifying local calendar days in ascending order and removes duplicate days', async () => {
    const activityDaysLearnerId = `${TEST_NAMESPACE}:activity-days-learner`;

    await recordEvent({
      suffix: 'day-oct-12-a',
      learnerId: activityDaysLearnerId,
      timestamp: '2026-10-11T18:45:00.000Z',
      eventType: 'lesson_opened',
    });

    await recordEvent({
      suffix: 'day-oct-12-b',
      learnerId: activityDaysLearnerId,
      timestamp: '2026-10-12T04:00:00.000Z',
      eventType: 'video_started',
    });

    await recordEvent({
      suffix: 'day-oct-13',
      learnerId: activityDaysLearnerId,
      timestamp: '2026-10-12T18:45:00.000Z',
      eventType: 'lesson_opened',
    });

    await recordEvent({
      suffix: 'day-not-qualifying',
      learnerId: activityDaysLearnerId,
      timestamp: '2026-10-13T05:00:00.000Z',
      eventType: 'recommendation_clicked',
    });

    const days = await historyRepository.listQualifyingActivityDays({
      learnerId: activityDaysLearnerId,
      tenantId: TENANT_ID,
      qualifyingEventTypes: ['lesson_opened', 'video_started'],
      timezone: 'Asia/Kolkata',
      asOf: new Date('2026-10-13T23:59:59.999Z'),
    });

    expect(days).toEqual(['2026-10-12', '2026-10-13']);
  });

  it('excludes events that occur after asOf', async () => {
    const asOfLearnerId = `${TEST_NAMESPACE}:as-of-learner`;

    await recordEvent({
      suffix: 'as-of-included',
      learnerId: asOfLearnerId,
      timestamp: '2026-10-12T18:00:00.000Z',
      eventType: 'lesson_opened',
    });

    await recordEvent({
      suffix: 'as-of-excluded',
      learnerId: asOfLearnerId,
      timestamp: '2026-10-12T20:00:00.000Z',
      eventType: 'lesson_opened',
    });

    const days = await historyRepository.listQualifyingActivityDays({
      learnerId: asOfLearnerId,
      tenantId: TENANT_ID,
      qualifyingEventTypes: ['lesson_opened'],
      timezone: 'Asia/Kolkata',
      asOf: new Date('2026-10-12T19:00:00.000Z'),
    });

    expect(days).toEqual(['2026-10-12']);
  });

  it('does not leak activity across learners when querying qualifying days', async () => {
    const targetLearnerId = `${TEST_NAMESPACE}:days-target-learner`;
    const otherLearnerId = `${TEST_NAMESPACE}:days-other-learner`;

    await recordEvent({
      suffix: 'days-target-learner',
      learnerId: targetLearnerId,
      timestamp: '2026-10-12T10:00:00.000Z',
      eventType: 'lesson_opened',
    });

    await recordEvent({
      suffix: 'days-other-learner',
      learnerId: otherLearnerId,
      timestamp: '2026-10-13T10:00:00.000Z',
      eventType: 'lesson_opened',
    });

    const days = await historyRepository.listQualifyingActivityDays({
      learnerId: targetLearnerId,
      tenantId: TENANT_ID,
      qualifyingEventTypes: ['lesson_opened'],
      timezone: 'UTC',
      asOf: new Date('2026-10-14T00:00:00.000Z'),
    });

    expect(days).toContain('2026-10-12');
    expect(days).not.toContain('2026-10-13');
  });
});
