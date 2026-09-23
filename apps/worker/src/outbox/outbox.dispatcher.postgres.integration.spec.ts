import { randomUUID } from 'node:crypto';

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  createPrismaClient,
  type Prisma,
  type PrismaClient,
} from '@gurusthalam/database';

import { OutboxDispatcher } from './outbox.dispatcher.js';
import {
  OUTBOX_LOCK_TIMEOUT_MS,
  OUTBOX_MAX_ATTEMPTS,
} from './outbox.constants.js';

const DATABASE_URL = process.env.DATABASE_URL;

const describePostgres = DATABASE_URL ? describe : describe.skip;

interface LoggerMock {
  readonly info: ReturnType<typeof vi.fn>;
  readonly warn: ReturnType<typeof vi.fn>;
  readonly error: ReturnType<typeof vi.fn>;
  readonly debug: ReturnType<typeof vi.fn>;
}

interface DispatcherInternals {
  claimPendingEvents: () => Promise<unknown[]>;
  releaseExpiredLocks: () => Promise<void>;
  instanceId: string;
  publish: (event: unknown) => Promise<void>;
}

interface DispatcherHandlers {
  courseDispatchHandler: {
    dispatch: (event: unknown) => Promise<void>;
    close: () => Promise<void>;
  };
  notificationDispatchHandler: {
    close: () => Promise<void>;
  };
}

type OutboxStatus =
  'PENDING' | 'PROCESSING' | 'PUBLISHED' | 'FAILED' | 'DEAD_LETTER';

interface OutboxFixture {
  readonly id: string;
  readonly eventType: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly dedupeKey: string;
  readonly payload: Prisma.InputJsonValue;
  readonly status: OutboxStatus;
  readonly attempts: number;
  readonly availableAt: Date;
  readonly lockedAt: Date | null;
  readonly lockedBy: string | null;
  readonly lastError: string | null;
  readonly lastAttemptAt: Date | null;
  readonly deadLetteredAt: Date | null;
  readonly publishedAt: Date | null;
}

function createLoggerMock(): LoggerMock {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

function getInternals(dispatcher: OutboxDispatcher): DispatcherInternals {
  return dispatcher as unknown as DispatcherInternals;
}

function getHandlers(dispatcher: OutboxDispatcher): DispatcherHandlers {
  return dispatcher as unknown as DispatcherHandlers;
}

function createCoursePayload(
  courseId: string,
  eventId = randomUUID(),
): Prisma.InputJsonValue {
  return {
    eventId,
    eventName: 'courses.course.created',
    eventVersion: 1,
    aggregateId: courseId,
    occurredAt: new Date().toISOString(),
    payload: {
      courseId,
      title: `Integration Course ${courseId}`,
      description: 'D3 PostgreSQL integration course.',
      level: 'BEGINNER',
      type: 'COURSE',
      visibility: 'PRIVATE',
      status: 'DRAFT',
      instructorId: `instructor-${courseId}`,
    },
  };
}

function createOutboxFixture(
  overrides: Partial<OutboxFixture> = {},
): OutboxFixture {
  const id = overrides.id ?? `d3-outbox-${randomUUID()}`;
  const aggregateId = overrides.aggregateId ?? `d3-course-${randomUUID()}`;

  return {
    id,
    eventType: overrides.eventType ?? 'courses.course.created',
    aggregateType: overrides.aggregateType ?? 'Course',
    aggregateId,
    dedupeKey: overrides.dedupeKey ?? `d3-course-domain-event:${randomUUID()}`,
    payload: overrides.payload ?? createCoursePayload(aggregateId),
    status: overrides.status ?? 'PENDING',
    attempts: overrides.attempts ?? 0,
    availableAt: overrides.availableAt ?? new Date(),
    lockedAt: overrides.lockedAt ?? null,
    lockedBy: overrides.lockedBy ?? null,
    lastError: overrides.lastError ?? null,
    lastAttemptAt: overrides.lastAttemptAt ?? null,
    deadLetteredAt: overrides.deadLetteredAt ?? null,
    publishedAt: overrides.publishedAt ?? null,
  };
}

async function deleteTestRows(prisma: PrismaClient): Promise<void> {
  await prisma.outboxEvent.deleteMany({
    where: {
      id: {
        startsWith: 'd3-outbox-',
      },
    },
  });
}

async function createOutboxRow(
  prisma: PrismaClient,
  fixture: OutboxFixture,
): Promise<void> {
  await prisma.outboxEvent.create({
    data: {
      id: fixture.id,
      eventType: fixture.eventType,
      aggregateType: fixture.aggregateType,
      aggregateId: fixture.aggregateId,
      dedupeKey: fixture.dedupeKey,
      payload: fixture.payload,
      status: fixture.status,
      attempts: fixture.attempts,
      availableAt: fixture.availableAt,
      lockedAt: fixture.lockedAt,
      lockedBy: fixture.lockedBy,
      lastError: fixture.lastError,
      lastAttemptAt: fixture.lastAttemptAt,
      deadLetteredAt: fixture.deadLetteredAt,
      publishedAt: fixture.publishedAt,
    },
  });
}

async function closeDispatcher(dispatcher: OutboxDispatcher): Promise<void> {
  const handlers = getHandlers(dispatcher);

  await Promise.all([
    handlers.notificationDispatchHandler.close(),
    handlers.courseDispatchHandler.close(),
  ]);
}

describePostgres(
  'OutboxDispatcher - PostgreSQL integration and concurrency hardening',
  () => {
    let prisma: PrismaClient;

    beforeAll(async () => {
      prisma = createPrismaClient();
      await prisma.$connect();
    });

    beforeEach(async () => {
      await deleteTestRows(prisma);
    });

    afterAll(async () => {
      if (!prisma) {
        return;
      }

      await deleteTestRows(prisma);
      await prisma.$disconnect();
    });

    it('atomically claims a pending Course event and persists PROCESSING ownership', async () => {
      const fixture = createOutboxFixture();

      await createOutboxRow(prisma, fixture);

      const dispatcher = new OutboxDispatcher(
        prisma,
        createLoggerMock() as never,
      );

      try {
        const events = await getInternals(dispatcher).claimPendingEvents();

        const claimed = events.find(
          (event) => (event as { id: string }).id === fixture.id,
        ) as
          | {
              id: string;
              eventType: string;
              aggregateType: string;
              aggregateId: string;
              dedupeKey: string;
              attempts: number;
            }
          | undefined;

        expect(claimed).toBeDefined();

        expect(claimed).toMatchObject({
          id: fixture.id,
          eventType: fixture.eventType,
          aggregateType: fixture.aggregateType,
          aggregateId: fixture.aggregateId,
          dedupeKey: fixture.dedupeKey,
          attempts: 1,
        });

        const persisted = await prisma.outboxEvent.findUnique({
          where: {
            id: fixture.id,
          },
        });

        expect(persisted).toMatchObject({
          id: fixture.id,
          status: 'PROCESSING',
          attempts: 1,
        });

        expect(persisted?.lockedBy).toBe(getInternals(dispatcher).instanceId);

        expect(persisted?.lockedAt).toBeInstanceOf(Date);
        expect(persisted?.lastAttemptAt).toBeInstanceOf(Date);
      } finally {
        await closeDispatcher(dispatcher);
      }
    });

    it('allows two dispatcher instances to compete without claiming the same event twice', async () => {
      const fixtures = Array.from({ length: 8 }, (_, index) =>
        createOutboxFixture({
          id: `d3-outbox-concurrent-${index + 1}-${randomUUID()}`,
          aggregateId: `d3-course-concurrent-${index + 1}`,
          dedupeKey: `d3-course-domain-event-concurrent-${index + 1}-${randomUUID()}`,
        }),
      );

      for (const fixture of fixtures) {
        await createOutboxRow(prisma, fixture);
      }

      const dispatcherOne = new OutboxDispatcher(
        prisma,
        createLoggerMock() as never,
      );

      const dispatcherTwo = new OutboxDispatcher(
        prisma,
        createLoggerMock() as never,
      );

      try {
        const [firstClaim, secondClaim] = await Promise.all([
          getInternals(dispatcherOne).claimPendingEvents(),
          getInternals(dispatcherTwo).claimPendingEvents(),
        ]);

        const claimedIds = [
          ...firstClaim.map((event) => (event as { id: string }).id),
          ...secondClaim.map((event) => (event as { id: string }).id),
        ];

        expect(new Set(claimedIds).size).toBe(claimedIds.length);

        expect(claimedIds).toHaveLength(fixtures.length);

        expect(
          claimedIds.every((id) =>
            fixtures.some((fixture) => fixture.id === id),
          ),
        ).toBe(true);

        const persisted = await prisma.outboxEvent.findMany({
          where: {
            id: {
              in: fixtures.map((fixture) => fixture.id),
            },
          },
          orderBy: {
            id: 'asc',
          },
        });

        expect(persisted).toHaveLength(fixtures.length);

        expect(
          persisted.every(
            (event) =>
              event.status === 'PROCESSING' &&
              event.attempts === 1 &&
              event.lockedBy !== null,
          ),
        ).toBe(true);

        const validOwners = new Set([
          getInternals(dispatcherOne).instanceId,
          getInternals(dispatcherTwo).instanceId,
        ]);

        expect(
          persisted.every(
            (event) =>
              event.lockedBy !== null && validOwners.has(event.lockedBy),
          ),
        ).toBe(true);
      } finally {
        await Promise.all([
          closeDispatcher(dispatcherOne),
          closeDispatcher(dispatcherTwo),
        ]);
      }
    });

    it('does not reclaim an actively owned PROCESSING event before the lock timeout', async () => {
      const activeLockOwner = `d3-active-owner-${randomUUID()}`;

      const fixture = createOutboxFixture({
        status: 'PROCESSING',
        attempts: 1,
        lockedAt: new Date(Date.now() - Math.floor(OUTBOX_LOCK_TIMEOUT_MS / 2)),
        lockedBy: activeLockOwner,
      });

      await createOutboxRow(prisma, fixture);

      const dispatcher = new OutboxDispatcher(
        prisma,
        createLoggerMock() as never,
      );

      try {
        const events = await getInternals(dispatcher).claimPendingEvents();

        expect(
          events.some((event) => (event as { id: string }).id === fixture.id),
        ).toBe(false);

        const persisted = await prisma.outboxEvent.findUnique({
          where: {
            id: fixture.id,
          },
        });

        expect(persisted).toMatchObject({
          status: 'PROCESSING',
          attempts: 1,
          lockedBy: activeLockOwner,
        });
      } finally {
        await closeDispatcher(dispatcher);
      }
    });

    it('recovers a stale PROCESSING event and makes it claimable by a new dispatcher', async () => {
      const staleOwner = `d3-stale-owner-${randomUUID()}`;

      const fixture = createOutboxFixture({
        status: 'PROCESSING',
        attempts: 2,
        lockedAt: new Date(Date.now() - OUTBOX_LOCK_TIMEOUT_MS - 1_000),
        lockedBy: staleOwner,
        lastError: 'Previous dispatcher stopped unexpectedly.',
      });

      await createOutboxRow(prisma, fixture);

      const dispatcher = new OutboxDispatcher(
        prisma,
        createLoggerMock() as never,
      );

      try {
        await getInternals(dispatcher).releaseExpiredLocks();

        const recovered = await prisma.outboxEvent.findUnique({
          where: {
            id: fixture.id,
          },
        });

        expect(recovered).toMatchObject({
          id: fixture.id,
          status: 'PENDING',
          attempts: 2,
          lockedBy: null,
          lockedAt: null,
        });

        const events = await getInternals(dispatcher).claimPendingEvents();

        const claimed = events.find(
          (event) => (event as { id: string }).id === fixture.id,
        );

        expect(claimed).toMatchObject({
          id: fixture.id,
          attempts: 3,
        });

        const persisted = await prisma.outboxEvent.findUnique({
          where: {
            id: fixture.id,
          },
        });

        expect(persisted).toMatchObject({
          status: 'PROCESSING',
          attempts: 3,
          lockedBy: getInternals(dispatcher).instanceId,
        });
      } finally {
        await closeDispatcher(dispatcher);
      }
    });

    it('persists retry state after a genuine failed Course dispatch', async () => {
      const fixture = createOutboxFixture({
        attempts: 1,
      });

      await createOutboxRow(prisma, fixture);

      const dispatcher = new OutboxDispatcher(
        prisma,
        createLoggerMock() as never,
      );

      const courseDispatchFailure = new Error(
        'Course transport failed during PostgreSQL integration.',
      );

      const courseDispatch = vi.fn().mockRejectedValue(courseDispatchFailure);

      const handlers = getHandlers(dispatcher);
      handlers.courseDispatchHandler.dispatch = courseDispatch;

      try {
        const events = await getInternals(dispatcher).claimPendingEvents();

        const claimed = events.find(
          (event) => (event as { id: string }).id === fixture.id,
        );

        expect(claimed).toBeDefined();

        const claimedEvent = claimed as {
          id: string;
          attempts: number;
          eventType: string;
          aggregateType: string;
          aggregateId: string;
          dedupeKey: string;
          payload: unknown;
        };

        expect(claimedEvent.attempts).toBe(2);

        const failureStartedAt = Date.now();

        await expect(
          getInternals(dispatcher).publish(claimedEvent),
        ).resolves.toBeUndefined();

        expect(courseDispatch).toHaveBeenCalledTimes(1);

        expect(courseDispatch).toHaveBeenCalledWith(
          expect.objectContaining({
            id: fixture.id,
            eventType: fixture.eventType,
            aggregateType: fixture.aggregateType,
            aggregateId: fixture.aggregateId,
            dedupeKey: fixture.dedupeKey,
            attempts: 2,
          }),
        );

        const persisted = await prisma.outboxEvent.findUnique({
          where: {
            id: fixture.id,
          },
        });

        expect(persisted).toMatchObject({
          id: fixture.id,
          status: 'PENDING',
          attempts: 2,
          lockedAt: null,
          lockedBy: null,
          lastError: 'Course transport failed during PostgreSQL integration.',
        });

        expect(persisted?.lastAttemptAt).toBeInstanceOf(Date);

        expect(persisted?.availableAt).toBeInstanceOf(Date);

        expect(
          persisted?.availableAt && persisted.availableAt.getTime(),
        ).toBeGreaterThan(failureStartedAt);

        expect(
          persisted?.availableAt && persisted.availableAt.getTime(),
        ).toBeGreaterThanOrEqual(failureStartedAt + 1_000);

        expect(persisted?.publishedAt).toBeNull();
      } finally {
        await closeDispatcher(dispatcher);
      }
    });

    it('routes a claimed Course event through the production Course dispatch boundary and persists PUBLISHED', async () => {
      const courseId = `d3-course-dispatch-${randomUUID()}`;
      const eventId = randomUUID();

      const fixture = createOutboxFixture({
        aggregateId: courseId,
        payload: createCoursePayload(courseId, eventId),
      });

      await createOutboxRow(prisma, fixture);

      const dispatcher = new OutboxDispatcher(
        prisma,
        createLoggerMock() as never,
      );

      const dispatchedEvents: unknown[] = [];

      const courseDispatch = vi
        .fn()
        .mockImplementation(async (event: unknown) => {
          dispatchedEvents.push(structuredClone(event));
        });

      const handlers = getHandlers(dispatcher);
      handlers.courseDispatchHandler.dispatch = courseDispatch;

      try {
        const events = await getInternals(dispatcher).claimPendingEvents();

        const claimed = events.find(
          (event) => (event as { id: string }).id === fixture.id,
        );

        expect(claimed).toBeDefined();

        const claimedEvent = claimed as {
          id: string;
          eventType: string;
          aggregateType: string;
          aggregateId: string;
          dedupeKey: string;
          payload: unknown;
          attempts: number;
        };

        await expect(
          getInternals(dispatcher).publish(claimedEvent),
        ).resolves.toBeUndefined();

        expect(courseDispatch).toHaveBeenCalledTimes(1);
        expect(dispatchedEvents).toHaveLength(1);

        expect(dispatchedEvents[0]).toMatchObject({
          id: fixture.id,
          eventType: 'courses.course.created',
          aggregateType: 'Course',
          aggregateId: courseId,
          dedupeKey: fixture.dedupeKey,
          attempts: 1,
          payload: {
            eventId,
            eventName: 'courses.course.created',
            eventVersion: 1,
            aggregateId: courseId,
            payload: {
              courseId,
              title: `Integration Course ${courseId}`,
              description: 'D3 PostgreSQL integration course.',
              level: 'BEGINNER',
              type: 'COURSE',
              visibility: 'PRIVATE',
              status: 'DRAFT',
              instructorId: `instructor-${courseId}`,
            },
          },
        });

        const persisted = await prisma.outboxEvent.findUnique({
          where: {
            id: fixture.id,
          },
        });

        expect(persisted).toMatchObject({
          id: fixture.id,
          status: 'PUBLISHED',
          attempts: 1,
          lockedAt: null,
          lockedBy: null,
          lastError: null,
        });

        expect(persisted?.publishedAt).toBeInstanceOf(Date);
      } finally {
        await closeDispatcher(dispatcher);
      }
    });

    it('persists DEAD_LETTER state after a genuine failed Course dispatch reaches the maximum attempts', async () => {
      const fixture = createOutboxFixture({
        attempts: OUTBOX_MAX_ATTEMPTS - 1,
      });

      await createOutboxRow(prisma, fixture);

      const dispatcher = new OutboxDispatcher(
        prisma,
        createLoggerMock() as never,
      );

      const courseDispatchFailure = new Error(
        'Course transport permanently failed during PostgreSQL integration.',
      );

      const courseDispatch = vi.fn().mockRejectedValue(courseDispatchFailure);

      const handlers = getHandlers(dispatcher);
      handlers.courseDispatchHandler.dispatch = courseDispatch;

      try {
        const events = await getInternals(dispatcher).claimPendingEvents();

        const claimed = events.find(
          (event) => (event as { id: string }).id === fixture.id,
        );

        expect(claimed).toBeDefined();

        const claimedEvent = claimed as {
          id: string;
          attempts: number;
          eventType: string;
          aggregateType: string;
          aggregateId: string;
          dedupeKey: string;
          payload: unknown;
        };

        expect(claimedEvent.attempts).toBe(OUTBOX_MAX_ATTEMPTS);

        await expect(
          getInternals(dispatcher).publish(claimedEvent),
        ).resolves.toBeUndefined();

        expect(courseDispatch).toHaveBeenCalledTimes(1);

        const persisted = await prisma.outboxEvent.findUnique({
          where: {
            id: fixture.id,
          },
        });

        expect(persisted).toMatchObject({
          id: fixture.id,
          status: 'DEAD_LETTER',
          attempts: OUTBOX_MAX_ATTEMPTS,
          lockedAt: null,
          lockedBy: null,
          lastError:
            'Course transport permanently failed during PostgreSQL integration.',
        });

        expect(persisted?.deadLetteredAt).toBeInstanceOf(Date);
        expect(persisted?.lastAttemptAt).toBeInstanceOf(Date);
        expect(persisted?.publishedAt).toBeNull();
      } finally {
        await closeDispatcher(dispatcher);
      }
    });

    it('does not re-claim an event after it is marked PUBLISHED', async () => {
      const fixture = createOutboxFixture({
        status: 'PUBLISHED',
        attempts: 1,
        lockedAt: null,
        lockedBy: null,
        publishedAt: new Date(),
      });

      await createOutboxRow(prisma, fixture);

      const dispatcher = new OutboxDispatcher(
        prisma,
        createLoggerMock() as never,
      );

      try {
        const events = await getInternals(dispatcher).claimPendingEvents();

        expect(events).toHaveLength(0);

        const persisted = await prisma.outboxEvent.findUnique({
          where: {
            id: fixture.id,
          },
        });

        expect(persisted).toMatchObject({
          status: 'PUBLISHED',
          attempts: 1,
        });
      } finally {
        await closeDispatcher(dispatcher);
      }
    });

    it('does not re-claim an event after it is DEAD_LETTER', async () => {
      const fixture = createOutboxFixture({
        status: 'DEAD_LETTER',
        attempts: OUTBOX_MAX_ATTEMPTS,
        lockedAt: null,
        lockedBy: null,
        deadLetteredAt: new Date(),
        lastError: 'Permanent dispatch failure.',
      });

      await createOutboxRow(prisma, fixture);

      const dispatcher = new OutboxDispatcher(
        prisma,
        createLoggerMock() as never,
      );

      try {
        const events = await getInternals(dispatcher).claimPendingEvents();

        expect(events).toHaveLength(0);

        const persisted = await prisma.outboxEvent.findUnique({
          where: {
            id: fixture.id,
          },
        });

        expect(persisted).toMatchObject({
          status: 'DEAD_LETTER',
          attempts: OUTBOX_MAX_ATTEMPTS,
        });
      } finally {
        await closeDispatcher(dispatcher);
      }
    });

    it('preserves the Course event envelope in the persisted Outbox row', async () => {
      const courseId = `d3-course-envelope-${randomUUID()}`;
      const eventId = randomUUID();

      const fixture = createOutboxFixture({
        aggregateId: courseId,
        payload: createCoursePayload(courseId, eventId),
      });

      await createOutboxRow(prisma, fixture);

      const persisted = await prisma.outboxEvent.findUnique({
        where: {
          id: fixture.id,
        },
      });

      expect(persisted).not.toBeNull();

      expect(persisted).toMatchObject({
        eventType: 'courses.course.created',
        aggregateType: 'Course',
        aggregateId: courseId,
        dedupeKey: fixture.dedupeKey,
      });

      expect(persisted?.payload).toMatchObject({
        eventId,
        eventName: 'courses.course.created',
        eventVersion: 1,
        aggregateId: courseId,
      });
    });
  },
);
