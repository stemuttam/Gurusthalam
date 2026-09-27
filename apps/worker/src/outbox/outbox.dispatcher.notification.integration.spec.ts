import { randomUUID } from 'node:crypto';

import { Queue } from 'bullmq';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createPrismaClient,
  type Prisma,
  type PrismaClient,
} from '@gurusthalam/database';

import { getRedisConfig } from '@gurusthalam/config';

import type { NotificationJobData } from '../processors/notification.processor.js';

import { QUEUE_NAMES, QUEUE_PREFIX } from '../queues/queue.constants.js';

import { OutboxDispatcher } from './outbox.dispatcher.js';

const DATABASE_URL = process.env.DATABASE_URL;

const REDIS_URL = process.env.REDIS_URL;

const describeIntegration =
  DATABASE_URL && REDIS_URL ? describe : describe.skip;

interface LoggerMock {
  readonly info: (...args: unknown[]) => void;

  readonly warn: (...args: unknown[]) => void;

  readonly error: (...args: unknown[]) => void;

  readonly debug: (...args: unknown[]) => void;
}

interface DispatcherInternals {
  claimPendingEvents: () => Promise<unknown[]>;

  publish: (event: unknown) => Promise<void>;
}

interface DispatcherHandlers {
  notificationDispatchHandler: {
    close: () => Promise<void>;
  };

  courseDispatchHandler: {
    close: () => Promise<void>;
  };
}

interface ClaimedOutboxEvent {
  readonly id: string;

  readonly eventType: string;

  readonly aggregateType: string;

  readonly aggregateId: string;

  readonly dedupeKey: string;

  readonly payload: unknown;

  readonly attempts: number;
}

function createLoggerMock(): LoggerMock {
  return {
    info: () => undefined,

    warn: () => undefined,

    error: () => undefined,

    debug: () => undefined,
  };
}

function getInternals(dispatcher: OutboxDispatcher): DispatcherInternals {
  return dispatcher as unknown as DispatcherInternals;
}

function getHandlers(dispatcher: OutboxDispatcher): DispatcherHandlers {
  return dispatcher as unknown as DispatcherHandlers;
}

function createNotificationPayload(
  notificationId: string,
  userId: string,
  idempotencyKey: string,
): Prisma.InputJsonValue {
  return {
    notificationId,

    channel: 'email',

    recipient: {
      userId,

      email: 'dispatcher-notification@example.com',

      deviceTokens: [
        'dispatcher-device-token-001',
        'dispatcher-device-token-002',
      ],
    },

    subject: 'Gurusthalam Dispatcher Integration',

    title: 'Dispatcher Notification Integration',

    body: 'Notification payload crossed the production Outbox dispatcher boundary.',

    template: 'notification-dispatcher-integration',

    templateData: {
      source: '4.13-C',

      environment: 'test',

      notification: {
        id: notificationId,

        category: 'course',

        action: 'created',
      },

      metadata: {
        integration: true,

        preserved: true,
      },

      tags: ['notification', 'outbox', 'dispatcher', 'integration'],
    },

    idempotencyKey,

    deliveryKey: `dispatcher-delivery-${randomUUID()}`,
  };
}

function createOutboxNotificationFixture(): {
  readonly id: string;

  readonly aggregateId: string;

  readonly dedupeKey: string;

  readonly payload: Prisma.InputJsonValue;
} {
  const notificationId = `d3-notification-${randomUUID()}`;

  const idempotencyKey = `d3-notification-idempotency-${randomUUID()}`;

  return {
    id: `d3-notification-outbox-${randomUUID()}`,

    aggregateId: notificationId,

    dedupeKey: `notification:${idempotencyKey}`,

    payload: createNotificationPayload(
      notificationId,
      `d3-user-${randomUUID()}`,
      idempotencyKey,
    ),
  };
}

function getNotificationJobId(payload: Prisma.InputJsonValue): string {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    Array.isArray(payload)
  ) {
    throw new Error('Notification integration payload must be an object.');
  }

  const idempotencyKey = (payload as Record<string, unknown>).idempotencyKey;

  if (typeof idempotencyKey !== 'string') {
    throw new Error(
      'Notification integration payload idempotencyKey must be a string.',
    );
  }

  return idempotencyKey;
}

function createObserverQueue(): Queue<NotificationJobData> {
  const redis = getRedisConfig();

  return new Queue<NotificationJobData>(QUEUE_NAMES.NOTIFICATIONS, {
    connection: {
      url: redis.url,
    },

    prefix: QUEUE_PREFIX,
  });
}

async function createOutboxRow(
  prisma: PrismaClient,
  fixture: ReturnType<typeof createOutboxNotificationFixture>,
): Promise<void> {
  await prisma.outboxEvent.create({
    data: {
      id: fixture.id,

      eventType: 'notification.enqueue',

      aggregateType: 'Notification',

      aggregateId: fixture.aggregateId,

      dedupeKey: fixture.dedupeKey,

      payload: fixture.payload,

      status: 'PENDING',

      attempts: 0,

      availableAt: new Date(),

      lockedAt: null,

      lockedBy: null,

      lastAttemptAt: null,

      lastError: null,

      deadLetteredAt: null,

      publishedAt: null,
    },
  });
}

async function deleteTestRows(prisma: PrismaClient): Promise<void> {
  await prisma.outboxEvent.deleteMany({
    where: {
      id: {
        startsWith: 'd3-notification-outbox-',
      },
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

describeIntegration(
  'OutboxDispatcher - Notification route PostgreSQL + Redis integration',
  () => {
    let prisma: PrismaClient;

    let observerQueue: Queue<NotificationJobData>;

    const createdJobIds: string[] = [];

    beforeAll(async () => {
      prisma = createPrismaClient();

      await prisma.$connect();

      observerQueue = createObserverQueue();

      await observerQueue.waitUntilReady();
    });

    beforeEach(async () => {
      await deleteTestRows(prisma);
    });

    afterAll(async () => {
      for (const jobId of createdJobIds) {
        await observerQueue.remove(jobId);
      }

      if (observerQueue) {
        await observerQueue.close();
      }

      if (prisma) {
        await deleteTestRows(prisma);

        await prisma.$disconnect();
      }
    });

    it('routes a persisted Notification Outbox event through the production dispatcher and publishes a real BullMQ job', async () => {
      const fixture = createOutboxNotificationFixture();

      await createOutboxRow(prisma, fixture);

      const jobId = getNotificationJobId(fixture.payload);

      createdJobIds.push(jobId);

      const dispatcher = new OutboxDispatcher(
        prisma,
        createLoggerMock() as never,
      );

      try {
        const events = await getInternals(dispatcher).claimPendingEvents();

        const claimed = events.find(
          (event) => (event as { id: string }).id === fixture.id,
        ) as ClaimedOutboxEvent | undefined;

        expect(claimed).toBeDefined();

        expect(claimed).toMatchObject({
          id: fixture.id,

          eventType: 'notification.enqueue',

          aggregateType: 'Notification',

          aggregateId: fixture.aggregateId,

          dedupeKey: fixture.dedupeKey,

          attempts: 1,
        });

        await expect(
          getInternals(dispatcher).publish(claimed),
        ).resolves.toBeUndefined();

        const job = await observerQueue.getJob(jobId);

        expect(job).toBeDefined();

        expect(job?.id).toBe(jobId);

        expect(job?.name).toBe('notification:email');
      } finally {
        await closeDispatcher(dispatcher);
      }
    });

    it('preserves the complete Notification payload across PostgreSQL Outbox, dispatcher routing, and real BullMQ transport', async () => {
      const fixture = createOutboxNotificationFixture();

      await createOutboxRow(prisma, fixture);

      const jobId = getNotificationJobId(fixture.payload);

      createdJobIds.push(jobId);

      const dispatcher = new OutboxDispatcher(
        prisma,
        createLoggerMock() as never,
      );

      try {
        const events = await getInternals(dispatcher).claimPendingEvents();

        const claimed = events.find(
          (event) => (event as { id: string }).id === fixture.id,
        ) as ClaimedOutboxEvent | undefined;

        expect(claimed).toBeDefined();

        await getInternals(dispatcher).publish(claimed);

        const job = await observerQueue.getJob(jobId);

        expect(job).toBeDefined();

        expect(job?.data).toEqual(fixture.payload);
      } finally {
        await closeDispatcher(dispatcher);
      }
    });

    it('persists PUBLISHED only after the Notification transport boundary succeeds', async () => {
      const fixture = createOutboxNotificationFixture();

      await createOutboxRow(prisma, fixture);

      const jobId = getNotificationJobId(fixture.payload);

      createdJobIds.push(jobId);

      const dispatcher = new OutboxDispatcher(
        prisma,
        createLoggerMock() as never,
      );

      try {
        const beforePublish = await prisma.outboxEvent.findUnique({
          where: {
            id: fixture.id,
          },
        });

        expect(beforePublish).toMatchObject({
          id: fixture.id,

          status: 'PENDING',

          attempts: 0,

          lockedAt: null,

          lockedBy: null,

          publishedAt: null,
        });

        const events = await getInternals(dispatcher).claimPendingEvents();

        const claimed = events.find(
          (event) => (event as { id: string }).id === fixture.id,
        ) as ClaimedOutboxEvent | undefined;

        expect(claimed).toBeDefined();

        expect(claimed?.attempts).toBe(1);

        const processing = await prisma.outboxEvent.findUnique({
          where: {
            id: fixture.id,
          },
        });

        expect(processing).toMatchObject({
          id: fixture.id,

          status: 'PROCESSING',

          attempts: 1,
        });

        expect(processing?.lockedBy).toBeTruthy();

        await getInternals(dispatcher).publish(claimed);

        const published = await prisma.outboxEvent.findUnique({
          where: {
            id: fixture.id,
          },
        });

        expect(published).toMatchObject({
          id: fixture.id,

          status: 'PUBLISHED',

          attempts: 1,

          lockedAt: null,

          lockedBy: null,

          lastError: null,
        });

        expect(published?.publishedAt).toBeInstanceOf(Date);

        const job = await observerQueue.getJob(jobId);

        expect(job).toBeDefined();
      } finally {
        await closeDispatcher(dispatcher);
      }
    });

    it('uses the Notification idempotency identity as the real BullMQ transport identity when the dispatcher publishes the event', async () => {
      const fixture = createOutboxNotificationFixture();

      await createOutboxRow(prisma, fixture);

      const jobId = getNotificationJobId(fixture.payload);

      createdJobIds.push(jobId);

      const dispatcher = new OutboxDispatcher(
        prisma,
        createLoggerMock() as never,
      );

      try {
        const firstClaim = await getInternals(dispatcher).claimPendingEvents();

        const claimed = firstClaim.find(
          (event) => (event as { id: string }).id === fixture.id,
        ) as ClaimedOutboxEvent | undefined;

        expect(claimed).toBeDefined();

        await getInternals(dispatcher).publish(claimed);

        const firstJob = await observerQueue.getJob(jobId);

        expect(firstJob).toBeDefined();

        expect(firstJob?.id).toBe(jobId);

        const persisted = await prisma.outboxEvent.findUnique({
          where: {
            id: fixture.id,
          },
        });

        expect(persisted).toMatchObject({
          status: 'PUBLISHED',

          attempts: 1,
        });

        expect(persisted?.publishedAt).toBeInstanceOf(Date);

        const matchingJobs = await observerQueue.getJobs([
          'waiting',

          'delayed',

          'active',

          'completed',

          'failed',
        ]);

        const matchingJobIds = matchingJobs.filter((job) => job.id === jobId);

        expect(matchingJobIds).toHaveLength(1);
      } finally {
        await closeDispatcher(dispatcher);
      }
    });
  },
);
