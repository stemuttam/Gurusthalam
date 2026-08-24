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

type NotificationFixture = {
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
  `phase-3-2-10-retry-integration-${randomUUID()}`;

describe(
  'NotificationOperationalService - PostgreSQL integration',
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

    async function createFailedFixture():
      Promise<NotificationFixture> {
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

            status:
              'FAILED',

            subject:
              'Phase 3.2.10 integration test',

            title:
              'Retry lifecycle',

            body:
              'PostgreSQL retry lifecycle integration test.',

            template:
              null,

            idempotencyKey,

            attempts:
              1,

            queuedAt:
              new Date(),

            processingAt:
              new Date(),

            failedAt:
              new Date(),

            failureReason:
              'Integration test failure',

            sentAt:
              null,

            provider:
              'integration-test',

            providerMessageId:
              null,
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
        NotificationFixture,
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
      'allows exactly one retry to win the PostgreSQL FAILED-to-RETRYING race',
      async () => {
        const fixture =
          await createFailedFixture();

        try {
          const results =
            await Promise.allSettled([
              service.retry(
                fixture.notificationId,
              ),

              service.retry(
                fixture.notificationId,
              ),
            ]);

          const fulfilled =
            results.filter(
              (
                result,
              ) =>
                result.status ===
                'fulfilled',
            );

          const rejected =
            results.filter(
              (
                result,
              ) =>
                result.status ===
                'rejected',
            );

          expect(
            fulfilled,
          ).toHaveLength(
            2,
          );

          expect(
            rejected,
          ).toHaveLength(
            0,
          );

          const responses =
            fulfilled.map(
              (
                result,
              ) =>
                result.value,
            );

          expect(
            responses[0]?.accepted,
          ).toBe(
            true,
          );

          expect(
            responses[1]?.accepted,
          ).toBe(
            true,
          );

          const outboxEventIds =
            responses.map(
              (
                response,
              ) =>
                response.outboxEventId,
            );

          expect(
            new Set(
              outboxEventIds,
            ).size,
          ).toBe(
            1,
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
            'RETRYING',
          );

          expect(
            notification?.idempotencyKey,
          ).toBe(
            fixture.idempotencyKey,
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
            1,
          );

          /*
           * The real worker may consume the outbox event before
           * this assertion executes. Both PENDING and PROCESSING
           * are valid active states.
           */
          expect(
            [
              'PENDING',
              'PROCESSING',
            ],
          ).toContain(
            outboxEvents[0]?.status,
          );

          expect(
            outboxEvents[0]?.dedupeKey,
          ).toMatch(
            new RegExp(
              `^notification-retry:${fixture.notificationId}:`,
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
      'allows a second manual retry after the first retry has reached a terminal outbox state and the notification fails again',
      async () => {
        const fixture =
          await createFailedFixture();

        try {
          const first =
            await service.retry(
              fixture.notificationId,
            );

          expect(
            first.accepted,
          ).toBe(
            true,
          );

          expect(
            first.action,
          ).toBe(
            'retry-scheduled',
          );

          const firstOutbox =
            await prisma.outboxEvent.findUnique({
              where: {
                id:
                  first.outboxEventId,
              },
            });

          expect(
            firstOutbox,
          ).not.toBeNull();

          /*
           * A worker may already have consumed the event. The
           * lifecycle test becomes deterministic by explicitly
           * moving it to a terminal outbox state.
           */
          await prisma.outboxEvent.update({
            where: {
              id:
                first.outboxEventId,
            },

            data: {
              status:
                'PUBLISHED',

              attempts:
                Math.max(
                  firstOutbox?.attempts ??
                    0,
                  1,
                ),
            },
          });

          await prisma.notification.update({
            where: {
              id:
                fixture.notificationDatabaseId,
            },

            data: {
              status:
                'FAILED',

              attempts:
                2,

              failedAt:
                new Date(),

              failureReason:
                'Second provider failure',
            },
          });

          const second =
            await service.retry(
              fixture.notificationId,
            );

          expect(
            second.accepted,
          ).toBe(
            true,
          );

          expect(
            second.action,
          ).toBe(
            'retry-scheduled',
          );

          expect(
            second.outboxEventId,
          ).not.toBe(
            first.outboxEventId,
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
            'RETRYING',
          );

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
            outboxEvents[0]?.id,
          ).toBe(
            first.outboxEventId,
          );

          expect(
            outboxEvents[0]?.status,
          ).toBe(
            'PUBLISHED',
          );

          expect(
            outboxEvents[1]?.id,
          ).toBe(
            second.outboxEventId,
          );

          /*
           * The worker may already have started processing the
           * second retry too.
           */
          expect(
            [
              'PENDING',
              'PROCESSING',
            ],
          ).toContain(
            outboxEvents[1]?.status,
          );

          expect(
            outboxEvents[0]?.dedupeKey,
          ).not.toBe(
            outboxEvents[1]?.dedupeKey,
          );

          expect(
            outboxEvents[0]?.dedupeKey,
          ).toMatch(
            new RegExp(
              `^notification-retry:${fixture.notificationId}:`,
            ),
          );

          expect(
            outboxEvents[1]?.dedupeKey,
          ).toMatch(
            new RegExp(
              `^notification-retry:${fixture.notificationId}:`,
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
      'preserves the original notification idempotency key in the retry payload',
      async () => {
        const fixture =
          await createFailedFixture();

        try {
          const result =
            await service.retry(
              fixture.notificationId,
            );

          expect(
            result.accepted,
          ).toBe(
            true,
          );

          const outboxEvent =
            await prisma.outboxEvent.findUnique({
              where: {
                id:
                  result.outboxEventId,
              },
            });

          expect(
            outboxEvent,
          ).not.toBeNull();

          expect(
            outboxEvent?.payload,
          ).toMatchObject({
            notificationId:
              fixture.notificationId,

            idempotencyKey:
              fixture.idempotencyKey,

            channel:
              'email',

            recipient: {
              userId:
                fixture.userId,
            },
          });
        } finally {
          await cleanupFixture(
            fixture,
          );
        }
      },
    );
  },
);