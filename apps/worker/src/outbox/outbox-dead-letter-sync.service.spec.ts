import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  OutboxDeadLetterSyncService,
} from './outbox-dead-letter-sync.service.js';

function createPrismaMock() {
  return {
    $connect:
      vi.fn(),

    $disconnect:
      vi.fn(),

    outboxEvent: {
      findMany:
        vi.fn(),
    },

    notification: {
      updateMany:
        vi.fn(),
    },
  };
}

function createLoggerMock() {
  return {
    info:
      vi.fn(),

    error:
      vi.fn(),

    warn:
      vi.fn(),

    debug:
      vi.fn(),
  };
}

describe(
  'OutboxDeadLetterSyncService',
  () => {
    it(
      'moves a normal RETRYING notification to FAILED',
      async () => {
        const prisma =
          createPrismaMock();

        const logger =
          createLoggerMock();

        prisma.outboxEvent.findMany
          .mockResolvedValue([
            {
              id:
                'outbox-001',

              aggregateId:
                'notification-db-001',

              payload: {
                notificationId:
                  'notification-001',

                idempotencyKey:
                  'idempotency-001',

                channel:
                  'email',
              },

              lastError:
                'Provider permanently rejected the message.',

              deadLetteredAt:
                new Date(),
            },
          ]);

        prisma.notification.updateMany
          .mockResolvedValue({
            count:
              1,
          });

        const service =
          new OutboxDeadLetterSyncService(
            logger as never,
          prisma as never,
  );

        const result =
          await service.synchronize();

        expect(
          result.scanned,
        ).toBe(
          1,
        );

        expect(
          result.synchronized,
        ).toBe(
          1,
        );

        expect(
          result.replayEventsSkipped,
        ).toBe(
          0,
        );

        expect(
          result.invalidEvents,
        ).toBe(
          0,
        );

        expect(
          prisma.notification.updateMany,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where:
              expect.objectContaining({
                notificationId:
                  'notification-001',

                status:
                  expect.objectContaining({
                    in: [
                      'QUEUED',
                      'PROCESSING',
                      'RETRYING',
                    ],
                  }),
              }),

            data:
              expect.objectContaining({
                status:
                  'FAILED',

                failedAt:
                  expect.any(
                    Date,
                  ),
              }),
          }),
        );
      },
    );

    it(
      'does not change the parent notification for replay dead letters',
      async () => {
        const prisma =
          createPrismaMock();

        const logger =
          createLoggerMock();

        prisma.outboxEvent.findMany
          .mockResolvedValue([
            {
              id:
                'outbox-replay-001',

              aggregateId:
                'notification-db-002',

              payload: {
                notificationId:
                  'notification-002',

                deliveryKey:
                  'replay-delivery-001',

                idempotencyKey:
                  'original-idempotency-002',

                channel:
                  'email',
              },

              lastError:
                'Replay provider failure.',

              deadLetteredAt:
                new Date(),
            },
          ]);

        const service =
          new OutboxDeadLetterSyncService(
            logger as never,
          prisma as never,
  );

        const result =
          await service.synchronize();

        expect(
          result.scanned,
        ).toBe(
          1,
        );

        expect(
          result.synchronized,
        ).toBe(
          0,
        );

        expect(
          result.replayEventsSkipped,
        ).toBe(
          1,
        );

        expect(
          prisma.notification.updateMany,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'does not update terminal parent notifications',
      async () => {
        const prisma =
          createPrismaMock();

        const logger =
          createLoggerMock();

        prisma.outboxEvent.findMany
          .mockResolvedValue([
            {
              id:
                'outbox-003',

              aggregateId:
                'notification-db-003',

              payload: {
                notificationId:
                  'notification-003',
              },

              lastError:
                'Permanent error.',

              deadLetteredAt:
                new Date(),
            },
          ]);

        prisma.notification.updateMany
          .mockResolvedValue({
            count:
              0,
          });

        const service =
          new OutboxDeadLetterSyncService(
            logger as never,
          prisma as never,
  );

        const result =
          await service.synchronize();

        expect(
          result.synchronized,
        ).toBe(
          0,
        );

        expect(
          prisma.notification.updateMany,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    it(
      'counts invalid dead-letter payloads without crashing',
      async () => {
        const prisma =
          createPrismaMock();

        const logger =
          createLoggerMock();

        prisma.outboxEvent.findMany
          .mockResolvedValue([
            {
              id:
                'outbox-invalid-001',

              aggregateId:
                'notification-db-004',

              payload:
                'invalid-payload',

              lastError:
                'Invalid event.',

              deadLetteredAt:
                new Date(),
            },
          ]);

        const service =
          new OutboxDeadLetterSyncService(
            logger as never,
          prisma as never,
  );

        const result =
          await service.synchronize();

        expect(
          result.invalidEvents,
        ).toBe(
          1,
        );

        expect(
          result.synchronized,
        ).toBe(
          0,
        );

        expect(
          prisma.notification.updateMany,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'returns an empty result for an empty dead-letter queue',
      async () => {
        const prisma =
          createPrismaMock();

        const logger =
          createLoggerMock();

        prisma.outboxEvent.findMany
          .mockResolvedValue([]);

        const service =
          new OutboxDeadLetterSyncService(
            logger as never,
            prisma as never,
            );

        const result =
          await service.synchronize();

        expect(
          result,
        ).toEqual({
          scanned:
            0,

          synchronized:
            0,

          replayEventsSkipped:
            0,

          invalidEvents:
            0,
        });
      },
    );
  },
);