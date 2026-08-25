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
  NotificationQueueService,
} from './notification.queue.js';

import {
  NotificationOrchestrationService,
} from './notification.orchestration.service.js';

import type {
  NotificationJobData,
} from './notification.types.js';

const testPrefix =
  `phase-3-2-16-fan-out-${randomUUID()}`;

type NotificationRow = {
  readonly id:
    string;

  readonly notificationId:
    string;

  readonly channel:
    unknown;

  readonly idempotencyKey:
    string;
};

type OutboxRow = {
  readonly id:
    string;

  readonly aggregateId:
    string;

  readonly dedupeKey:
    string;

  readonly eventType:
    string;
};

describe(
  'NotificationOrchestrationService - PostgreSQL integration',
  () => {
    let prisma:
      PrismaService;

    let queue:
      NotificationQueueService;

    let orchestration:
      NotificationOrchestrationService;

    /*
     * Phase 3.2.16 exercises the queue/persistence boundary,
     * so template rendering is deliberately not part of this test.
     */
    const fakeTemplateService =
      {} as never;

    const createNotificationData =
      (
        channel:
          'email' |
          'push' |
          'in-app',

        logicalNotificationId:
          string,

        logicalIdempotencyKey:
          string,
      ):
        NotificationJobData => ({
        notificationId:
          `${logicalNotificationId}:${channel}`,

        channel,

        recipient: {
          userId:
            `${testPrefix}-user`,

          ...(channel ===
          'email'
            ? {
                email:
                  `${testPrefix}@example.com`,
              }
            : {}),

          ...(channel ===
          'push'
            ? {
                deviceTokens: [
                  `${testPrefix}-device`,
                ],
              }
            : {}),
        },

        body:
          'Phase 3.2.16 multi-channel fan-out integration test.',

        idempotencyKey:
          `${logicalIdempotencyKey}:${channel}`,
      });

    beforeAll(
      async () => {
        prisma =
          new PrismaService();

        await prisma.$connect();

        queue =
          new NotificationQueueService(
            prisma,

            fakeTemplateService,
          );

        orchestration =
          new NotificationOrchestrationService(
            queue,
          );
      },
    );

    afterAll(
      async () => {
        /*
         * OutboxEvent has no FK cascade to Notification, so clean up
         * outbox rows explicitly before deleting notifications.
         */
        const notifications =
          await prisma.notification.findMany({
            where: {
              notificationId: {
                startsWith:
                  testPrefix,
              },
            },

            select: {
              id:
                true,
            },
          });

        const aggregateIds =
          notifications.map(
            (
              notification,
            ) =>
              notification.id,
          );

        if (
          aggregateIds.length >
          0
        ) {
          await prisma.outboxEvent.deleteMany({
            where: {
              aggregateId: {
                in:
                  aggregateIds,
              },
            },
          });
        }

        await prisma.notification.deleteMany({
          where: {
            notificationId: {
              startsWith:
                testPrefix,
            },
          },
        });

        await prisma.$disconnect();
      },
    );

    it(
      'creates independent channel notifications and outbox events',
      async () => {
        const logicalNotificationId =
          `${testPrefix}-independent`;

        const logicalIdempotencyKey =
          `${testPrefix}-independent-key`;

        const result =
          await orchestration.fanOut(
            logicalNotificationId,

            [
              createNotificationData(
                'email',

                logicalNotificationId,

                logicalIdempotencyKey,
              ),

              createNotificationData(
                'push',

                logicalNotificationId,

                logicalIdempotencyKey,
              ),

              createNotificationData(
                'in-app',

                logicalNotificationId,

                logicalIdempotencyKey,
              ),
            ],
          );

        expect(
          result.accepted,
        ).toBe(
          true,
        );

        expect(
          result.action,
        ).toBe(
          'fan-out-scheduled',
        );

        expect(
          result.orchestrationId,
        ).toBe(
          logicalNotificationId,
        );

        expect(
          result.channels,
        ).toHaveLength(
          3,
        );

        expect(
          result.channels.map(
            (
              item,
            ) =>
              item.channel,
          ),
        ).toEqual([
          'email',
          'push',
          'in-app',
        ]);

        const notifications =
          (
            await prisma.notification.findMany({
              where: {
                notificationId: {
                  startsWith:
                    `${logicalNotificationId}:`,
                },
              },

              orderBy: {
                notificationId:
                  'asc',
              },

              select: {
                id:
                  true,

                notificationId:
                  true,

                channel:
                  true,

                idempotencyKey:
                  true,
              },
            })
          ) as NotificationRow[];

        expect(
          notifications,
        ).toHaveLength(
          3,
        );

        expect(
          notifications.map(
            (
              item,
            ) =>
              item.notificationId,
          ).sort(),
        ).toEqual(
          [
            `${logicalNotificationId}:email`,
            `${logicalNotificationId}:in-app`,
            `${logicalNotificationId}:push`,
          ].sort(),
        );

        expect(
          notifications.map(
            (
              item,
            ) =>
              item.idempotencyKey,
          ).sort(),
        ).toEqual(
          [
            `${logicalIdempotencyKey}:email`,
            `${logicalIdempotencyKey}:in-app`,
            `${logicalIdempotencyKey}:push`,
          ].sort(),
        );

        expect(
          new Set(
            notifications.map(
              (
                item,
              ) =>
                item.notificationId,
            ),
          ).size,
        ).toBe(
          notifications.length,
        );

        expect(
          new Set(
            notifications.map(
              (
                item,
              ) =>
                item.idempotencyKey,
            ),
          ).size,
        ).toBe(
          notifications.length,
        );

        expect(
          new Set(
            notifications.map(
              (
                item,
              ) =>
                String(
                  item.channel,
                ),
            ),
          ),
        ).toEqual(
          new Set([
            'EMAIL',
            'IN_APP',
            'PUSH',
          ]),
        );

        const notificationIds =
          notifications.map(
            (
              item,
            ) =>
              item.id,
          );

        const outboxEvents =
          (
            await prisma.outboxEvent.findMany({
              where: {
                aggregateId: {
                  in:
                    notificationIds,
                },

                eventType:
                  'notification.enqueue',
              },

              orderBy: {
                createdAt:
                  'asc',
              },

              select: {
                id:
                  true,

                aggregateId:
                  true,

                dedupeKey:
                  true,

                eventType:
                  true,
              },
            })
          ) as OutboxRow[];

        expect(
          outboxEvents,
        ).toHaveLength(
          3,
        );

        expect(
          new Set(
            outboxEvents.map(
              (
                item,
              ) =>
                item.aggregateId,
            ),
          ).size,
        ).toBe(
          outboxEvents.length,
        );

        expect(
          new Set(
            outboxEvents.map(
              (
                item,
              ) =>
                item.dedupeKey,
            ),
          ).size,
        ).toBe(
          outboxEvents.length,
        );

        expect(
          outboxEvents.every(
            (
              item,
            ) =>
              item.eventType ===
              'notification.enqueue',
          ),
        ).toBe(
          true,
        );

        expect(
          outboxEvents.map(
            (
              item,
            ) =>
              item.dedupeKey,
          ).sort(),
        ).toEqual(
          [
            `${logicalIdempotencyKey}:email`,
            `${logicalIdempotencyKey}:in-app`,
            `${logicalIdempotencyKey}:push`,
          ].map(
            (
              key,
            ) =>
              `notification:${key}`,
          ).sort(),
        );
      },
    );

    it(
      'is idempotent across a repeated orchestration request',
      async () => {
        const logicalNotificationId =
          `${testPrefix}-repeat`;

        const logicalIdempotencyKey =
          `${testPrefix}-repeat-key`;

        const createFanOutData =
          () => [
            createNotificationData(
              'email',

              logicalNotificationId,

              logicalIdempotencyKey,
            ),

            createNotificationData(
              'push',

              logicalNotificationId,

              logicalIdempotencyKey,
            ),
          ];

        const first =
          await orchestration.fanOut(
            logicalNotificationId,

            createFanOutData(),
          );

        const second =
          await orchestration.fanOut(
            logicalNotificationId,

            createFanOutData(),
          );

        expect(
          first.accepted,
        ).toBe(
          true,
        );

        expect(
          second.accepted,
        ).toBe(
          true,
        );

        expect(
          first.channels,
        ).toHaveLength(
          2,
        );

        expect(
          second.channels,
        ).toHaveLength(
          2,
        );

        expect(
          second.channels.map(
            (
              item,
            ) =>
              item.outboxEventId,
          ),
        ).toEqual(
          first.channels.map(
            (
              item,
            ) =>
              item.outboxEventId,
          ),
        );

        expect(
          second.channels.map(
            (
              item,
            ) =>
              item.notificationId,
          ),
        ).toEqual(
          first.channels.map(
            (
              item,
            ) =>
              item.notificationId,
          ),
        );

        const notifications =
          (
            await prisma.notification.findMany({
              where: {
                notificationId: {
                  in: [
                    `${logicalNotificationId}:email`,
                    `${logicalNotificationId}:push`,
                  ],
                },
              },

              select: {
                id:
                  true,

                notificationId:
                  true,

                channel:
                  true,

                idempotencyKey:
                  true,
              },
            })
          ) as NotificationRow[];

        expect(
          notifications,
        ).toHaveLength(
          2,
        );

        expect(
          new Set(
            notifications.map(
              (
                item,
              ) =>
                item.notificationId,
            ),
          ).size,
        ).toBe(
          2,
        );

        expect(
          new Set(
            notifications.map(
              (
                item,
              ) =>
                item.idempotencyKey,
            ),
          ).size,
        ).toBe(
          2,
        );

        const notificationIds =
          notifications.map(
            (
              item,
            ) =>
              item.id,
          );

        const outboxEvents =
          (
            await prisma.outboxEvent.findMany({
              where: {
                aggregateId: {
                  in:
                    notificationIds,
                },

                eventType:
                  'notification.enqueue',
              },

              select: {
                id:
                  true,

                aggregateId:
                  true,

                dedupeKey:
                  true,

                eventType:
                  true,
              },
            })
          ) as OutboxRow[];

        expect(
          outboxEvents,
        ).toHaveLength(
          2,
        );

        expect(
          new Set(
            outboxEvents.map(
              (
                item,
              ) =>
                item.dedupeKey,
            ),
          ).size,
        ).toBe(
          2,
        );
      },
    );

    it(
      'keeps channel identities independent when all channels share the same logical notification',
      async () => {
        const logicalNotificationId =
          `${testPrefix}-identity`;

        const logicalIdempotencyKey =
          `${testPrefix}-identity-key`;

        const result =
          await orchestration.fanOut(
            logicalNotificationId,

            [
              createNotificationData(
                'email',

                logicalNotificationId,

                logicalIdempotencyKey,
              ),

              createNotificationData(
                'push',

                logicalNotificationId,

                logicalIdempotencyKey,
              ),

              createNotificationData(
                'in-app',

                logicalNotificationId,

                logicalIdempotencyKey,
              ),
            ],
          );

        const notificationIds =
          result.channels.map(
            (
              item,
            ) =>
              item.notificationId,
          );

        const idempotencyKeys =
          result.channels.map(
            (
              item,
            ) =>
              item.jobId,
          );

        expect(
          new Set(
            notificationIds,
          ).size,
        ).toBe(
          3,
        );

        expect(
          new Set(
            idempotencyKeys,
          ).size,
        ).toBe(
          3,
        );

        expect(
          notificationIds,
        ).toEqual([
          `${logicalNotificationId}:email`,
          `${logicalNotificationId}:push`,
          `${logicalNotificationId}:in-app`,
        ]);

        expect(
          idempotencyKeys,
        ).toEqual([
          `${logicalIdempotencyKey}:email`,
          `${logicalIdempotencyKey}:push`,
          `${logicalIdempotencyKey}:in-app`,
        ]);

        const notifications =
          (
            await prisma.notification.findMany({
              where: {
                idempotencyKey: {
                  in:
                    idempotencyKeys,
                },
              },

              select: {
                id:
                  true,

                notificationId:
                  true,

                channel:
                  true,

                idempotencyKey:
                  true,
              },
            })
          ) as NotificationRow[];

        expect(
          notifications,
        ).toHaveLength(
          3,
        );
      },
    );
  },
);