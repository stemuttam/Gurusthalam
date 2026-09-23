import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OUTBOX_MAX_ATTEMPTS } from './outbox.constants.js';
import { OutboxDispatcher } from './outbox.dispatcher.js';

const notificationDispatch = vi.fn();
const notificationClose = vi.fn();

const courseDispatch = vi.fn();
const courseClose = vi.fn();

vi.mock('./notification-outbox-dispatch.handler.js', () => ({
  NotificationOutboxDispatchHandler: class {
    static fromRedisConfig() {
      return {
        dispatch: notificationDispatch,
        close: notificationClose,
      };
    }
  },
}));

vi.mock('./course-outbox-dispatch.handler.js', () => ({
  BullMqCourseOutboxDispatchHandler: class {
    static fromRedisConfig() {
      return {
        dispatch: courseDispatch,
        close: courseClose,
      };
    }
  },
}));

type OutboxStatus =
  'PENDING' | 'PROCESSING' | 'PUBLISHED' | 'FAILED' | 'DEAD_LETTER';

interface OutboxEventRow {
  readonly id: string;
  readonly eventType: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly dedupeKey: string;
  readonly payload: unknown;
  readonly attempts: number;
}

interface PrismaMock {
  readonly $queryRaw: ReturnType<typeof vi.fn>;
  readonly $executeRaw: ReturnType<typeof vi.fn>;
  readonly outboxEvent: {
    readonly findUnique: ReturnType<typeof vi.fn>;
    readonly updateMany: ReturnType<typeof vi.fn>;
  };
}

interface LoggerMock {
  readonly info: ReturnType<typeof vi.fn>;
  readonly error: ReturnType<typeof vi.fn>;
}

interface DispatcherInternals {
  readonly instanceId: string;
  running: boolean;
  polling: boolean;
  poll(): Promise<void>;
}

const createLoggerMock = (): LoggerMock => ({
  info: vi.fn(),
  error: vi.fn(),
});

const createPrismaMock = (): PrismaMock => ({
  $queryRaw: vi.fn().mockResolvedValue([]),
  $executeRaw: vi.fn().mockResolvedValue(0),
  outboxEvent: {
    findUnique: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
});

const createNotificationEvent = (
  overrides: Partial<OutboxEventRow> = {},
): OutboxEventRow => ({
  id: 'outbox-notification-001',
  eventType: 'notification.enqueue',
  aggregateType: 'Notification',
  aggregateId: 'notification-001',
  dedupeKey: 'notification-dedupe-001',
  payload: {
    notificationId: 'notification-001',
    channel: 'email',
    idempotencyKey: 'notification-idempotency-001',
    body: 'Hello from Gurusthalam',
    recipient: {
      userId: 'user-001',
      email: 'user@example.com',
    },
  },
  attempts: 1,
  ...overrides,
});

const createCourseEvent = (
  overrides: Partial<OutboxEventRow> = {},
): OutboxEventRow => ({
  id: 'outbox-course-001',
  eventType: 'courses.course.created',
  aggregateType: 'Course',
  aggregateId: 'course-001',
  dedupeKey: 'course-domain-event:course-event-001',
  payload: {
    eventId: 'course-event-001',
    eventName: 'courses.course.created',
    eventVersion: 1,
    aggregateId: 'course-001',
    occurredAt: '2026-09-23T00:00:00.000Z',
    payload: {
      courseId: 'course-001',
      title: 'TypeScript Fundamentals',
      description: 'Learn TypeScript.',
      level: 'BEGINNER',
      type: 'COURSE',
      visibility: 'PRIVATE',
      status: 'DRAFT',
      instructorId: 'instructor-001',
    },
  },
  attempts: 1,
  ...overrides,
});

const createDispatcher = (
  prisma: PrismaMock,
  logger: LoggerMock,
): OutboxDispatcher => new OutboxDispatcher(prisma as never, logger as never);

const getInternals = (dispatcher: OutboxDispatcher): DispatcherInternals =>
  dispatcher as unknown as DispatcherInternals;

const activateDispatcher = (dispatcher: OutboxDispatcher): void => {
  getInternals(dispatcher).running = true;
};

const configureOwnedEvent = (
  prisma: PrismaMock,
  dispatcher: OutboxDispatcher,
  status: OutboxStatus = 'PROCESSING',
): void => {
  prisma.outboxEvent.findUnique.mockResolvedValue({
    status,
    lockedBy: getInternals(dispatcher).instanceId,
    attempts: 1,
  });
};

describe('OutboxDispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    notificationDispatch.mockResolvedValue(undefined);
    notificationClose.mockResolvedValue(undefined);

    courseDispatch.mockResolvedValue(undefined);
    courseClose.mockResolvedValue(undefined);
  });

  describe('polling lifecycle', () => {
    it('starts polling and does not create overlapping poll timers', async () => {
      vi.useFakeTimers();

      try {
        const prisma = createPrismaMock();
        const logger = createLoggerMock();
        const dispatcher = createDispatcher(prisma, logger);
        const internals = getInternals(dispatcher);

        const pollSpy = vi
          .spyOn(internals, 'poll')
          .mockResolvedValue(undefined);

        dispatcher.start();
        dispatcher.start();

        expect(pollSpy).toHaveBeenCalledTimes(1);
        expect(logger.info).toHaveBeenCalledWith(
          'Outbox dispatcher started',
          expect.objectContaining({
            operation: 'outbox.start',
            service: 'outbox',
          }),
        );

        await dispatcher.stop();
      } finally {
        vi.useRealTimers();
      }
    });

    it('stops cleanly and closes both specialized dispatch handlers', async () => {
      const prisma = createPrismaMock();
      const logger = createLoggerMock();
      const dispatcher = createDispatcher(prisma, logger);
      const internals = getInternals(dispatcher);

      vi.spyOn(internals, 'poll').mockResolvedValue(undefined);

      dispatcher.start();

      await dispatcher.stop();

      expect(notificationClose).toHaveBeenCalledTimes(1);
      expect(courseClose).toHaveBeenCalledTimes(1);

      expect(logger.info).toHaveBeenCalledWith(
        'Outbox dispatcher stopped',
        expect.objectContaining({
          operation: 'outbox.stop',
          service: 'outbox',
        }),
      );
    });

    it('does nothing when stop is called while already stopped', async () => {
      const prisma = createPrismaMock();
      const logger = createLoggerMock();
      const dispatcher = createDispatcher(prisma, logger);

      await dispatcher.stop();

      expect(notificationClose).not.toHaveBeenCalled();
      expect(courseClose).not.toHaveBeenCalled();
    });

    it('does not overlap polling cycles within one dispatcher instance', async () => {
      const prisma = createPrismaMock();
      const logger = createLoggerMock();
      const dispatcher = createDispatcher(prisma, logger);
      const internals = getInternals(dispatcher);

      activateDispatcher(dispatcher);

      prisma.$executeRaw.mockResolvedValue(0);
      prisma.$queryRaw.mockResolvedValue([]);

      const firstPoll = internals.poll();
      const secondPoll = internals.poll();

      await Promise.all([firstPoll, secondPoll]);

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });

  describe('Course dispatch routing', () => {
    it('routes a Course event to the Course dispatch handler', async () => {
      const prisma = createPrismaMock();
      const logger = createLoggerMock();
      const dispatcher = createDispatcher(prisma, logger);
      const event = createCourseEvent();

      activateDispatcher(dispatcher);
      prisma.$queryRaw.mockResolvedValue([event]);
      configureOwnedEvent(prisma, dispatcher);

      await getInternals(dispatcher).poll();

      expect(courseDispatch).toHaveBeenCalledTimes(1);
      expect(courseDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          id: event.id,
          eventType: event.eventType,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          dedupeKey: event.dedupeKey,
          attempts: event.attempts,
        }),
      );

      expect(notificationDispatch).not.toHaveBeenCalled();
    });

    it('preserves the complete Course event envelope during routing', async () => {
      const prisma = createPrismaMock();
      const logger = createLoggerMock();
      const dispatcher = createDispatcher(prisma, logger);
      const event = createCourseEvent();

      activateDispatcher(dispatcher);
      prisma.$queryRaw.mockResolvedValue([event]);
      configureOwnedEvent(prisma, dispatcher);

      await getInternals(dispatcher).poll();

      expect(courseDispatch).toHaveBeenCalledWith({
        id: event.id,
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        dedupeKey: event.dedupeKey,
        payload: event.payload,
        attempts: event.attempts,
      });
    });

    it('marks a successfully dispatched Course event as PUBLISHED', async () => {
      const prisma = createPrismaMock();
      const logger = createLoggerMock();
      const dispatcher = createDispatcher(prisma, logger);
      const event = createCourseEvent();

      activateDispatcher(dispatcher);
      prisma.$queryRaw.mockResolvedValue([event]);
      configureOwnedEvent(prisma, dispatcher);

      await getInternals(dispatcher).poll();

      expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: event.id,
            status: 'PROCESSING',
            lockedBy: getInternals(dispatcher).instanceId,
          },
          data: expect.objectContaining({
            status: 'PUBLISHED',
            lockedAt: null,
            lockedBy: null,
            lastError: null,
          }),
        }),
      );
    });
  });

  describe('Notification dispatch routing', () => {
    it('routes a Notification event to the Notification dispatch handler', async () => {
      const prisma = createPrismaMock();
      const logger = createLoggerMock();
      const dispatcher = createDispatcher(prisma, logger);
      const event = createNotificationEvent();

      activateDispatcher(dispatcher);
      prisma.$queryRaw.mockResolvedValue([event]);
      configureOwnedEvent(prisma, dispatcher);

      await getInternals(dispatcher).poll();

      expect(notificationDispatch).toHaveBeenCalledTimes(1);
      expect(notificationDispatch).toHaveBeenCalledWith(event.payload);

      expect(courseDispatch).not.toHaveBeenCalled();
    });

    it('marks a successfully dispatched Notification event as PUBLISHED', async () => {
      const prisma = createPrismaMock();
      const logger = createLoggerMock();
      const dispatcher = createDispatcher(prisma, logger);
      const event = createNotificationEvent();

      activateDispatcher(dispatcher);
      prisma.$queryRaw.mockResolvedValue([event]);
      configureOwnedEvent(prisma, dispatcher);

      await getInternals(dispatcher).poll();

      expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: event.id,
            status: 'PROCESSING',
            lockedBy: getInternals(dispatcher).instanceId,
          },
          data: expect.objectContaining({
            status: 'PUBLISHED',
            publishedAt: expect.any(Date),
            lockedAt: null,
            lockedBy: null,
            lastError: null,
          }),
        }),
      );
    });
  });

  describe('claim and ownership boundaries', () => {
    it('claims pending events through the atomic database query', async () => {
      const prisma = createPrismaMock();
      const logger = createLoggerMock();
      const dispatcher = createDispatcher(prisma, logger);

      activateDispatcher(dispatcher);
      prisma.$queryRaw.mockResolvedValue([]);

      await getInternals(dispatcher).poll();

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('re-checks database ownership before dispatching', async () => {
      const prisma = createPrismaMock();
      const logger = createLoggerMock();
      const dispatcher = createDispatcher(prisma, logger);
      const event = createNotificationEvent();

      activateDispatcher(dispatcher);
      prisma.$queryRaw.mockResolvedValue([event]);

      prisma.outboxEvent.findUnique.mockResolvedValue({
        status: 'PROCESSING',
        lockedBy: 'another-dispatcher',
        attempts: event.attempts,
      });

      await getInternals(dispatcher).poll();

      expect(notificationDispatch).not.toHaveBeenCalled();
      expect(courseDispatch).not.toHaveBeenCalled();
      expect(prisma.outboxEvent.updateMany).not.toHaveBeenCalled();
    });

    it('does not dispatch an event already marked PUBLISHED', async () => {
      const prisma = createPrismaMock();
      const logger = createLoggerMock();
      const dispatcher = createDispatcher(prisma, logger);
      const event = createNotificationEvent();

      activateDispatcher(dispatcher);
      prisma.$queryRaw.mockResolvedValue([event]);

      prisma.outboxEvent.findUnique.mockResolvedValue({
        status: 'PUBLISHED',
        lockedBy: null,
        attempts: event.attempts,
      });

      await getInternals(dispatcher).poll();

      expect(notificationDispatch).not.toHaveBeenCalled();
      expect(prisma.outboxEvent.updateMany).not.toHaveBeenCalled();
    });

    it('does not dispatch an event already marked DEAD_LETTER', async () => {
      const prisma = createPrismaMock();
      const logger = createLoggerMock();
      const dispatcher = createDispatcher(prisma, logger);
      const event = createNotificationEvent();

      activateDispatcher(dispatcher);
      prisma.$queryRaw.mockResolvedValue([event]);

      prisma.outboxEvent.findUnique.mockResolvedValue({
        status: 'DEAD_LETTER',
        lockedBy: null,
        attempts: event.attempts,
      });

      await getInternals(dispatcher).poll();

      expect(notificationDispatch).not.toHaveBeenCalled();
      expect(prisma.outboxEvent.updateMany).not.toHaveBeenCalled();
    });

    it('does not update the event when ownership is lost after successful transport publication', async () => {
      const prisma = createPrismaMock();
      const logger = createLoggerMock();
      const dispatcher = createDispatcher(prisma, logger);
      const event = createNotificationEvent();

      activateDispatcher(dispatcher);
      prisma.$queryRaw.mockResolvedValue([event]);

      prisma.outboxEvent.findUnique
        .mockResolvedValueOnce({
          status: 'PROCESSING',
          lockedBy: getInternals(dispatcher).instanceId,
          attempts: event.attempts,
        })
        .mockResolvedValueOnce({
          status: 'PROCESSING',
          lockedBy: getInternals(dispatcher).instanceId,
          attempts: event.attempts,
        });

      prisma.outboxEvent.updateMany.mockResolvedValueOnce({
        count: 0,
      });

      await getInternals(dispatcher).poll();

      expect(notificationDispatch).toHaveBeenCalledTimes(1);
      expect(prisma.outboxEvent.updateMany).toHaveBeenCalledTimes(1);

      expect(logger.info).toHaveBeenCalledWith(
        `Outbox event publication race: ${event.id}`,
        expect.objectContaining({
          operation: 'outbox.publish.race',
          service: 'outbox',
        }),
      );
    });

    it('does not mutate retry state when ownership is lost during failure handling', async () => {
      const prisma = createPrismaMock();
      const logger = createLoggerMock();
      const dispatcher = createDispatcher(prisma, logger);
      const event = createNotificationEvent();

      activateDispatcher(dispatcher);
      prisma.$queryRaw.mockResolvedValue([event]);

      prisma.outboxEvent.findUnique
        .mockResolvedValueOnce({
          status: 'PROCESSING',
          lockedBy: getInternals(dispatcher).instanceId,
          attempts: event.attempts,
        })
        .mockResolvedValueOnce({
          status: 'PROCESSING',
          lockedBy: 'another-dispatcher',
          attempts: event.attempts,
        });

      notificationDispatch.mockRejectedValue(
        new Error('Notification transport failed.'),
      );

      await getInternals(dispatcher).poll();

      expect(prisma.outboxEvent.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('retry handling', () => {
    it('returns a failed dispatch to PENDING with exponential backoff', async () => {
      const prisma = createPrismaMock();
      const logger = createLoggerMock();
      const dispatcher = createDispatcher(prisma, logger);
      const event = createNotificationEvent({
        attempts: 1,
      });

      activateDispatcher(dispatcher);
      prisma.$queryRaw.mockResolvedValue([event]);
      configureOwnedEvent(prisma, dispatcher);

      notificationDispatch.mockRejectedValue(
        new Error('Temporary notification transport failure.'),
      );

      await getInternals(dispatcher).poll();

      expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: event.id,
            status: 'PROCESSING',
            lockedBy: getInternals(dispatcher).instanceId,
          },
          data: expect.objectContaining({
            status: 'PENDING',
            availableAt: expect.any(Date),
            lockedAt: null,
            lockedBy: null,
            deadLetteredAt: null,
            lastAttemptAt: expect.any(Date),
            lastError: 'Temporary notification transport failure.',
          }),
        }),
      );
    });

    it('uses a larger retry delay for later Outbox attempts', async () => {
      const prisma = createPrismaMock();
      const logger = createLoggerMock();
      const dispatcher = createDispatcher(prisma, logger);

      const firstEvent = createNotificationEvent({
        id: 'outbox-retry-001',
        attempts: 1,
      });

      const laterEvent = createNotificationEvent({
        id: 'outbox-retry-002',
        attempts: 3,
      });

      activateDispatcher(dispatcher);
      prisma.$queryRaw.mockResolvedValue([firstEvent]);
      configureOwnedEvent(prisma, dispatcher);

      notificationDispatch.mockRejectedValue(new Error('Temporary failure.'));

      const beforeFirst = Date.now();

      await getInternals(dispatcher).poll();

      const firstCall = prisma.outboxEvent.updateMany.mock.calls[0]?.[0];
      const firstAvailableAt = firstCall?.data?.availableAt as Date;

      expect(firstAvailableAt).toBeInstanceOf(Date);
      expect(firstAvailableAt.getTime()).toBeGreaterThanOrEqual(
        beforeFirst + 900,
      );

      vi.clearAllMocks();

      notificationDispatch.mockRejectedValue(new Error('Temporary failure.'));

      prisma.$queryRaw.mockResolvedValue([laterEvent]);

      configureOwnedEvent(prisma, dispatcher);

      const beforeLater = Date.now();

      await getInternals(dispatcher).poll();

      const laterCall = prisma.outboxEvent.updateMany.mock.calls[0]?.[0];
      const laterAvailableAt = laterCall?.data?.availableAt as Date;

      expect(laterAvailableAt).toBeInstanceOf(Date);
      expect(laterAvailableAt.getTime()).toBeGreaterThanOrEqual(
        beforeLater + 3900,
      );
    });

    it('dead-letters an event when the maximum Outbox attempt is reached', async () => {
      const prisma = createPrismaMock();
      const logger = createLoggerMock();
      const dispatcher = createDispatcher(prisma, logger);
      const event = createNotificationEvent({
        attempts: OUTBOX_MAX_ATTEMPTS,
      });

      activateDispatcher(dispatcher);
      prisma.$queryRaw.mockResolvedValue([event]);
      configureOwnedEvent(prisma, dispatcher);

      notificationDispatch.mockRejectedValue(
        new Error('Permanent notification transport failure.'),
      );

      await getInternals(dispatcher).poll();

      expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: event.id,
            status: 'PROCESSING',
            lockedBy: getInternals(dispatcher).instanceId,
          },
          data: expect.objectContaining({
            status: 'DEAD_LETTER',
            availableAt: expect.any(Date),
            lockedAt: null,
            lockedBy: null,
            deadLetteredAt: expect.any(Date),
            lastAttemptAt: expect.any(Date),
            lastError: 'Permanent notification transport failure.',
          }),
        }),
      );

      expect(logger.error).toHaveBeenCalledWith(
        `Outbox event dead-lettered: ${event.id}`,
        expect.any(Error),
        expect.objectContaining({
          operation: 'outbox.dead_lettered',
          service: 'outbox',
        }),
      );
    });

    it('records non-Error transport failures as strings', async () => {
      const prisma = createPrismaMock();
      const logger = createLoggerMock();
      const dispatcher = createDispatcher(prisma, logger);
      const event = createNotificationEvent();

      activateDispatcher(dispatcher);
      prisma.$queryRaw.mockResolvedValue([event]);
      configureOwnedEvent(prisma, dispatcher);

      notificationDispatch.mockRejectedValue('transport failure as string');

      await getInternals(dispatcher).poll();

      expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastError: 'transport failure as string',
          }),
        }),
      );
    });
  });

  describe('stale lock recovery', () => {
    it('attempts to recover stale PROCESSING events before claiming work', async () => {
      const prisma = createPrismaMock();
      const logger = createLoggerMock();
      const dispatcher = createDispatcher(prisma, logger);

      activateDispatcher(dispatcher);
      prisma.$executeRaw.mockResolvedValue(1);
      prisma.$queryRaw.mockResolvedValue([]);

      await getInternals(dispatcher).poll();

      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('does not dispatch when stale-lock recovery succeeds but no events are claimable', async () => {
      const prisma = createPrismaMock();
      const logger = createLoggerMock();
      const dispatcher = createDispatcher(prisma, logger);

      activateDispatcher(dispatcher);
      prisma.$executeRaw.mockResolvedValue(1);
      prisma.$queryRaw.mockResolvedValue([]);

      await getInternals(dispatcher).poll();

      expect(notificationDispatch).not.toHaveBeenCalled();
      expect(courseDispatch).not.toHaveBeenCalled();
    });
  });

  describe('poll error isolation', () => {
    it('logs a poll-level database failure without throwing it to the caller', async () => {
      const prisma = createPrismaMock();
      const logger = createLoggerMock();
      const dispatcher = createDispatcher(prisma, logger);

      activateDispatcher(dispatcher);
      prisma.$executeRaw.mockRejectedValue(new Error('Database unavailable.'));

      await expect(getInternals(dispatcher).poll()).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(
        'Outbox dispatcher poll failed',
        expect.any(Error),
        expect.objectContaining({
          operation: 'outbox.poll.error',
          service: 'outbox',
        }),
      );

      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('continues to the next event after a route-level transport failure', async () => {
      const prisma = createPrismaMock();
      const logger = createLoggerMock();
      const dispatcher = createDispatcher(prisma, logger);

      activateDispatcher(dispatcher);

      const first = createCourseEvent({
        id: 'course-first',
        aggregateId: 'course-first',
        dedupeKey: 'course-domain-event:first',
        payload: {
          eventId: 'course-event-first',
          eventName: 'courses.course.created',
          eventVersion: 1,
          aggregateId: 'course-first',
          occurredAt: '2026-09-23T00:00:00.000Z',
          payload: {
            courseId: 'course-first',
            title: 'First Course',
            description: 'First course.',
            level: 'BEGINNER',
            type: 'COURSE',
            visibility: 'PRIVATE',
            status: 'DRAFT',
            instructorId: 'instructor-first',
          },
        },
      });

      const second = createCourseEvent({
        id: 'course-second',
        aggregateId: 'course-second',
        dedupeKey: 'course-domain-event:second',
        payload: {
          eventId: 'course-event-second',
          eventName: 'courses.course.created',
          eventVersion: 1,
          aggregateId: 'course-second',
          occurredAt: '2026-09-23T00:00:00.000Z',
          payload: {
            courseId: 'course-second',
            title: 'Second Course',
            description: 'Second course.',
            level: 'BEGINNER',
            type: 'COURSE',
            visibility: 'PRIVATE',
            status: 'DRAFT',
            instructorId: 'instructor-second',
          },
        },
      });

      prisma.$queryRaw.mockResolvedValue([first, second]);
      prisma.outboxEvent.findUnique.mockImplementation(
        async ({ where }: { where: { id: string } }) => {
          if (where.id === first.id || where.id === second.id) {
            return {
              status: 'PROCESSING',
              lockedBy: getInternals(dispatcher).instanceId,
              attempts: 1,
            };
          }

          return null;
        },
      );

      courseDispatch
        .mockRejectedValueOnce(new Error('First Course transport failed.'))
        .mockResolvedValueOnce(undefined);

      await getInternals(dispatcher).poll();

      expect(courseDispatch).toHaveBeenCalledTimes(2);
      expect(courseDispatch).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          id: first.id,
          eventType: first.eventType,
          aggregateType: first.aggregateType,
          aggregateId: first.aggregateId,
          dedupeKey: first.dedupeKey,
        }),
      );
      expect(courseDispatch).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          id: second.id,
          eventType: second.eventType,
          aggregateType: second.aggregateType,
          aggregateId: second.aggregateId,
          dedupeKey: second.dedupeKey,
        }),
      );

      expect(prisma.outboxEvent.updateMany).toHaveBeenCalledTimes(2);
      expect(logger.error).toHaveBeenCalledWith(
        `Outbox event retrying: ${first.id}`,
        expect.any(Error),
        expect.objectContaining({
          operation: 'outbox.retrying',
          service: 'outbox',
        }),
      );
    });
  });
});
