import {
  randomUUID,
} from 'node:crypto';

import {
  createPrismaClient,
  type PrismaClient,
} from '@gurusthalam/database';

import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';

import {
  GurusthalamLogger,
} from '@gurusthalam/logger';

import {
  OutboxDeadLetterSyncService,
} from './outbox-dead-letter-sync.service.js';

const prefix =
  `phase-3-2-12-dead-letter-sync-${randomUUID()}`;

describe(
  'OutboxDeadLetterSyncService - PostgreSQL integration',
  () => {
    let prisma:
      PrismaClient;

    let service:
      OutboxDeadLetterSyncService;

    const logger =
      new GurusthalamLogger({
        service:
          'phase-3-2-12-test',

        environment:
          'test',
      });

    beforeAll(
      async () => {
        prisma =
          createPrismaClient();

        await prisma.$connect();

        service =
          new OutboxDeadLetterSyncService(
            logger,
            prisma,
          );
      },
    );

    afterAll(
      async () => {
        await prisma.$disconnect();
      },
    );

    it(
      'synchronizes a normal RETRYING notification to FAILED',
      async () => {
        const notificationId =
          `${prefix}-normal-notification`;

        const notification =
          await prisma.notification.create({
            data: {
              notificationId,

              userId:
                `${prefix}-user`,

              channel:
                'EMAIL',

              status:
                'RETRYING',

              body:
                'Dead-letter synchronization integration test.',

              idempotencyKey:
                `${prefix}-idempotency`,

              attempts:
                10,

              failureReason:
                'Retry exhausted',

              processingAt:
                new Date(),

              failedAt:
                null,

              sentAt:
                null,

              provider:
                'integration-test',

              providerMessageId:
                'integration-provider',
            },
          });

        const outbox =
          await prisma.outboxEvent.create({
            data: {
              eventType:
                'notification.enqueue',

              aggregateType:
                'Notification',

              aggregateId:
                notification.id,

              dedupeKey:
                `${prefix}-normal-dedupe`,

              payload: {
                notificationId,

                idempotencyKey:
                  `${prefix}-idempotency`,

                channel:
                  'email',

                recipient: {
                  userId:
                    `${prefix}-user`,
                },

                body:
                  'Dead-letter synchronization integration test.',
              },

              status:
                'DEAD_LETTER',

              attempts:
                10,

              availableAt:
                new Date(),

              deadLetteredAt:
                new Date(),

              lastAttemptAt:
                new Date(),

              lastError:
                'Permanent provider rejection.',
            },
          });

        try {
          const result =
            await service.synchronize();

          expect(
            result.synchronized,
          ).toBeGreaterThanOrEqual(
            1,
          );

          const updated =
            await prisma.notification.findUnique({
              where: {
                id:
                  notification.id,
              },
            });

          expect(
            updated?.status,
          ).toBe(
            'FAILED',
          );

          expect(
            updated?.failureReason,
          ).toContain(
            outbox.id,
          );

          expect(
            updated?.failedAt,
          ).not.toBeNull();
        } finally {
          await prisma.outboxEvent.delete({
            where: {
              id:
                outbox.id,
            },
          });

          await prisma.notification.delete({
            where: {
              id:
                notification.id,
            },
          });
        }
      },
    );

    it(
      'does not fail the parent notification for a replay dead letter',
      async () => {
        const notificationId =
          `${prefix}-replay-notification`;

        const notification =
          await prisma.notification.create({
            data: {
              notificationId,

              userId:
                `${prefix}-replay-user`,

              channel:
                'EMAIL',

              status:
                'SENT',

              body:
                'Replay dead-letter isolation integration test.',

              idempotencyKey:
                `${prefix}-replay-idempotency`,

              attempts:
                1,

              sentAt:
                new Date(),

              processingAt:
                new Date(),

              provider:
                'integration-test',

              providerMessageId:
                'original-provider-message',
            },
          });

        const outbox =
          await prisma.outboxEvent.create({
            data: {
              eventType:
                'notification.enqueue',

              aggregateType:
                'Notification',

              aggregateId:
                notification.id,

              dedupeKey:
                `${prefix}-replay-dedupe`,

              payload: {
                notificationId,

                deliveryKey:
                  `${prefix}-replay-delivery`,

                idempotencyKey:
                  `${prefix}-replay-idempotency`,

                channel:
                  'email',

                recipient: {
                  userId:
                    `${prefix}-replay-user`,
                },

                body:
                  'Replay dead-letter isolation integration test.',
              },

              status:
                'DEAD_LETTER',

              attempts:
                10,

              availableAt:
                new Date(),

              deadLetteredAt:
                new Date(),

              lastAttemptAt:
                new Date(),

              lastError:
                'Replay provider permanently rejected the delivery.',
            },
          });

        try {
          const result =
            await service.synchronize();

          expect(
            result.replayEventsSkipped,
          ).toBeGreaterThanOrEqual(
            1,
          );

          const updated =
            await prisma.notification.findUnique({
              where: {
                id:
                  notification.id,
              },
            });

          expect(
            updated?.status,
          ).toBe(
            'SENT',
          );

          expect(
            updated?.providerMessageId,
          ).toBe(
            'original-provider-message',
          );
        } finally {
          await prisma.outboxEvent.delete({
            where: {
              id:
                outbox.id,
            },
          });

          await prisma.notification.delete({
            where: {
              id:
                notification.id,
            },
          });
        }
      },
    );
  },
);