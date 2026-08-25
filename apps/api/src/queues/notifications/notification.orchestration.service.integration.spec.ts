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
  `phase-3-2-15-orchestration-${randomUUID()}`;

describe(
  'NotificationOrchestrationService - PostgreSQL integration',
  () => {
    let prisma:
      PrismaService;

    let queue:
      NotificationQueueService;

    let orchestration:
      NotificationOrchestrationService;

    const fakeTemplateService =
      {} as never;

    const createData =
      (
        channel:
          'email' |
          'push' |
          'in-app',
      ):
        NotificationJobData => ({
        notificationId:
          `${testPrefix}:${channel}`,

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
          'Phase 3.2.15 PostgreSQL orchestration integration test.',

        idempotencyKey:
          `${testPrefix}:${channel}`,
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
        await prisma.notification.deleteMany({
          where: {
            notificationId: {
              startsWith:
                `${testPrefix}:`,
            },
          },
        });

        await prisma.$disconnect();
      },
    );

    it(
      'creates independent channel notifications and outbox events',
      async () => {
        const result =
          await orchestration.fanOut(
            testPrefix,

            [
              createData(
                'email',
              ),

              createData(
                'push',
              ),

              createData(
                'in-app',
              ),
            ],
          );

        expect(
          result.accepted,
        ).toBe(
          true,
        );

        expect(
          result.channels,
        ).toHaveLength(
          3,
        );

        const notifications =
          await prisma.notification.findMany({
            where: {
              notificationId: {
                startsWith:
                  `${testPrefix}:`,
              },
            },

            orderBy: {
              notificationId:
                'asc',
            },
          });

        expect(
          notifications,
        ).toHaveLength(
          3,
        );

        const notificationChannels:
          string[] =
          notifications.map(
            (
              item: {
                readonly channel:
                  string;
              },
            ) =>
              item.channel,
          );

        expect(
          new Set(
            notificationChannels,
          ).size,
        ).toBe(
          3,
        );

        const aggregateIds:
          string[] =
          notifications.map(
            (
              item: {
                readonly id:
                  string;
              },
            ) =>
              item.id,
          );

        const outbox =
          await prisma.outboxEvent.findMany({
            where: {
              aggregateId: {
                in:
                  aggregateIds,
              },

              eventType:
                'notification.enqueue',
            },
          });

        expect(
          outbox,
        ).toHaveLength(
          3,
        );

        const dedupeKeys:
          string[] =
          outbox.map(
            (
              item: {
                readonly dedupeKey:
                  string;
              },
            ) =>
              item.dedupeKey,
          );

        expect(
          new Set(
            dedupeKeys,
          ).size,
        ).toBe(
          3,
        );
      },
    );

    it(
      'is idempotent across a repeated orchestration request',
      async () => {
        const repeatPrefix =
          `${testPrefix}-repeat`;

        const first =
          await orchestration.fanOut(
            repeatPrefix,

            [
              {
                ...createData(
                  'email',
                ),

                notificationId:
                  `${repeatPrefix}:email`,

                idempotencyKey:
                  `${repeatPrefix}:email`,
              },

              {
                ...createData(
                  'push',
                ),

                notificationId:
                  `${repeatPrefix}:push`,

                idempotencyKey:
                  `${repeatPrefix}:push`,
              },
            ],
          );

        const second =
          await orchestration.fanOut(
            repeatPrefix,

            [
              {
                ...createData(
                  'email',
                ),

                notificationId:
                  `${repeatPrefix}:email`,

                idempotencyKey:
                  `${repeatPrefix}:email`,
              },

              {
                ...createData(
                  'push',
                ),

                notificationId:
                  `${repeatPrefix}:push`,

                idempotencyKey:
                  `${repeatPrefix}:push`,
              },
            ],
          );

        expect(
          second.channels.map(
            (
              item:
                {
                  readonly outboxEventId:
                    string;
                },
            ) =>
              item.outboxEventId,
          ),
        ).toEqual(
          first.channels.map(
            (
              item:
                {
                  readonly outboxEventId:
                    string;
                },
            ) =>
              item.outboxEventId,
          ),
        );

        const notifications =
          await prisma.notification.findMany({
            where: {
              notificationId: {
                in: [
                  `${repeatPrefix}:email`,
                  `${repeatPrefix}:push`,
                ],
              },
            },
          });

        expect(
          notifications,
        ).toHaveLength(
          2,
        );
      },
    );
  },
);