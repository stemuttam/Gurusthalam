import {
  randomUUID,
} from 'node:crypto';

import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';

import {
  PrismaService,
} from '../../database/prisma/prisma.service.js';

import {
  NotificationOperationalService,
} from './notification-operational.service.js';

type ReplayFixture = {
  readonly notificationDatabaseId:
    string;

  readonly notificationId:
    string;

  readonly userId:
    string;

  readonly idempotencyKey:
    string;
};

const suitePrefix =
  `phase-3-2-10-replay-${randomUUID()}`;

describe(
  'NotificationOperationalService - PostgreSQL replay integration',
  () => {
    let prisma:
      PrismaService;

    let service:
      NotificationOperationalService;

    beforeAll(
      async () => {
        prisma =
          new PrismaService();

        await prisma.$connect();

        service =
          new NotificationOperationalService(
            prisma,
          );
      },
    );

    afterAll(
      async () => {
        if (
          !prisma
        ) {
          return;
        }

        await prisma.$disconnect();
      },
    );

    async function createFixture(
      status:
        | 'SENT'
        | 'FAILED',
    ): Promise<ReplayFixture> {
      const fixtureId =
        randomUUID();

      const notificationId =
        `${suitePrefix}-${fixtureId}-notification`;

      const userId =
        `${suitePrefix}-${fixtureId}-user`;

      const idempotencyKey =
        `${suitePrefix}-${fixtureId}-idempotency`;

      const notification =
        await prisma.notification.create({
          data: {
            notificationId,

            userId,

            channel:
              'EMAIL',

            status,

            subject:
              'Phase 3.2.10 replay integration',

            title:
              'Replay integration',

            body:
              'PostgreSQL replay integration test.',

            template:
              null,

            idempotencyKey,

            attempts:
              status ===
              'SENT'
                ? 1
                : 2,

            queuedAt:
              new Date(),

            processingAt:
              new Date(),

            sentAt:
              status ===
              'SENT'
                ? new Date()
                : null,

            failedAt:
              status ===
              'FAILED'
                ? new Date()
                : null,

            failureReason:
              status ===
              'FAILED'
                ? 'Integration test failure'
                : null,

            provider:
              'integration-test',

            providerMessageId:
              status ===
              'SENT'
                ? `${fixtureId}-provider-message`
                : null,
          },
        });

      return {
        notificationDatabaseId:
          notification.id,

        notificationId,

        userId,

        idempotencyKey,
      };
    }

    async function cleanupFixture(
      fixture:
        ReplayFixture,
    ): Promise<void> {
      await prisma.outboxEvent.deleteMany({
        where: {
          aggregateId:
            fixture.notificationDatabaseId,
        },
      });

      await prisma.notificationDelivery.deleteMany({
        where: {
          notificationId:
            fixture.notificationId,
        },
      });

      await prisma.notification.deleteMany({
        where: {
          id:
            fixture.notificationDatabaseId,
        },
      });
    }

    it(
      'replays a SENT notification with a new outbox identity',
      async () => {
        const fixture =
          await createFixture(
            'SENT',
          );

        try {
          const result =
            await service.replay(
              fixture.notificationId,
            );

          expect(
            result.accepted,
          ).toBe(
            true,
          );

          expect(
            result.action,
          ).toBe(
            'replay-scheduled',
          );

          expect(
            result.status,
          ).toBe(
            'PENDING',
          );

          expect(
            result.notificationId,
          ).toBe(
            fixture.notificationId,
          );

          expect(
            result.replayId,
          ).toBeTruthy();

          expect(
            result.idempotencyKey,
          ).toMatch(
            new RegExp(
              `^notification-replay:${fixture.notificationId}:`,
            ),
          );

          expect(
            result.deliveryKey,
          ).toBeTruthy();

          const notification =
            await prisma.notification.findUnique({
              where: {
                id:
                  fixture.notificationDatabaseId,
              },
            });

          expect(
            notification,
          ).not.toBeNull();

          expect(
            notification?.notificationId,
          ).toBe(
            fixture.notificationId,
          );

          expect(
            notification?.idempotencyKey,
          ).toBe(
            fixture.idempotencyKey,
          );

          expect(
            notification?.status,
          ).toBe(
            'SENT',
          );

          const outboxEvents =
            await prisma.outboxEvent.findMany({
              where: {
                aggregateId:
                  fixture.notificationDatabaseId,

                eventType:
                  'notification.enqueue',
              },
            });

          expect(
            outboxEvents,
          ).toHaveLength(
            1,
          );

          const outbox =
            outboxEvents[0];

          expect(
            outbox,
          ).toBeDefined();

          expect(
            outbox?.id,
          ).toBe(
            result.outboxEventId,
          );

          expect(
            outbox?.status,
          ).toBe(
            'PENDING',
          );

          expect(
            outbox?.dedupeKey,
          ).toBe(
            `notification-replay:${fixture.notificationId}:${result.replayId}`,
          );
        } finally {
          await cleanupFixture(
            fixture,
          );
        }
      },
    );

    it(
      'replays a FAILED notification while preserving the parent notification',
      async () => {
        const fixture =
          await createFixture(
            'FAILED',
          );

        try {
          const result =
            await service.replay(
              fixture.notificationId,
            );

          expect(
            result.accepted,
          ).toBe(
            true,
          );

          expect(
            result.status,
          ).toBe(
            'PENDING',
          );

          const notification =
            await prisma.notification.findUnique({
              where: {
                id:
                  fixture.notificationDatabaseId,
              },
            });

          expect(
            notification,
          ).not.toBeNull();

          expect(
            notification?.status,
          ).toBe(
            'FAILED',
          );

          expect(
            notification?.idempotencyKey,
          ).toBe(
            fixture.idempotencyKey,
          );

          const outbox =
            await prisma.outboxEvent.findUnique({
              where: {
                id:
                  result.outboxEventId,
              },
            });

          expect(
            outbox,
          ).not.toBeNull();

          expect(
            outbox?.aggregateId,
          ).toBe(
            fixture.notificationDatabaseId,
          );

          expect(
            outbox?.dedupeKey,
          ).toMatch(
            new RegExp(
              `^notification-replay:${fixture.notificationId}:`,
            ),
          );
        } finally {
          await cleanupFixture(
            fixture,
          );
        }
      },
    );

    it(
      'creates a distinct replay identity for every replay request',
      async () => {
        const fixture =
          await createFixture(
            'SENT',
          );

        try {
          const first =
            await service.replay(
              fixture.notificationId,
            );

          const second =
            await service.replay(
              fixture.notificationId,
            );

          expect(
            first.replayId,
          ).not.toBe(
            second.replayId,
          );

          expect(
            first.idempotencyKey,
          ).not.toBe(
            second.idempotencyKey,
          );

          expect(
            first.deliveryKey,
          ).not.toBe(
            second.deliveryKey,
          );

          expect(
            first.outboxEventId,
          ).not.toBe(
            second.outboxEventId,
          );

          const outboxEvents =
            await prisma.outboxEvent.findMany({
              where: {
                aggregateId:
                  fixture.notificationDatabaseId,

                eventType:
                  'notification.enqueue',
              },

              orderBy: {
                createdAt:
                  'asc',
              },
            });

          expect(
            outboxEvents,
          ).toHaveLength(
            2,
          );

          expect(
            outboxEvents[0]?.dedupeKey,
          ).not.toBe(
            outboxEvents[1]?.dedupeKey,
          );
        } finally {
          await cleanupFixture(
            fixture,
          );
        }
      },
    );

    it(
      'creates no NotificationDelivery during replay scheduling',
      async () => {
        const fixture =
          await createFixture(
            'SENT',
          );

        try {
          await service.replay(
            fixture.notificationId,
          );

          const deliveries =
            await prisma.notificationDelivery.findMany({
              where: {
                notificationId:
                  fixture.notificationId,
              },
            });

          /*
           * Delivery persistence belongs to worker execution.
           * Replay scheduling must not manufacture a delivery row
           * before the worker actually processes the outbox event.
           */
          expect(
            deliveries,
          ).toHaveLength(
            0,
          );
        } finally {
          await cleanupFixture(
            fixture,
          );
        }
      },
    );
  },
);