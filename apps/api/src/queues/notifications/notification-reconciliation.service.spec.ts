import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  NotificationReconciliationService,
} from './notification-reconciliation.service.js';

function createPrismaMock() {
  return {
    notificationDelivery: {
      findMany:
        vi.fn(),

      updateMany:
        vi.fn(),
    },

    notification: {
      findMany:
        vi.fn(),
    },

    outboxEvent: {
      groupBy:
        vi.fn(),
    },
  };
}

describe(
  'NotificationReconciliationService',
  () => {
    it(
      'reports stale processing deliveries',
      async () => {
        const prisma =
          createPrismaMock();

        prisma.notificationDelivery.findMany
          .mockResolvedValue([
            {
              id:
                'delivery-001',

              notificationId:
                'notification-001',

              deliveryKey:
                'delivery-key-001',

              status:
                'PROCESSING',

              lastAttemptAt:
                new Date(
                  Date.now() -
                    10 *
                      60 *
                      1000,
                ),

              createdAt:
                new Date(
                  Date.now() -
                    10 *
                      60 *
                      1000,
                ),
            },
          ]);

        prisma.notification.findMany
          .mockResolvedValue([
            {
              id:
                'db-notification-001',

              notificationId:
                'notification-001',

              status:
                'RETRYING',

              deliveries: [
                {
                  status:
                    'PROCESSING',
                },
              ],
            },
          ]);

        prisma.outboxEvent.groupBy
          .mockResolvedValue([
            {
              aggregateId:
                'db-notification-001',

              _count: {
                _all:
                  1,
              },
            },
          ]);

        const service =
          new NotificationReconciliationService(
            prisma as never,
          );

        const result =
          await service.audit({
            staleAfterSeconds:
              300,

            limit:
              100,
          });

        expect(
          result.scannedDeliveries,
        ).toBe(
          1,
        );

        expect(
          result.staleProcessingDeliveries,
        ).toBe(
          1,
        );

        expect(
          result.anomalies,
        ).toHaveLength(
          1,
        );

        expect(
          result.anomalies[0]?.type,
        ).toBe(
          'STALE_PROCESSING_DELIVERY',
        );
      },
    );

    it(
      'reports a RETRYING notification without active outbox',
      async () => {
        const prisma =
          createPrismaMock();

        prisma.notificationDelivery.findMany
          .mockResolvedValue([]);

        prisma.notification.findMany
          .mockResolvedValue([
            {
              id:
                'db-notification-002',

              notificationId:
                'notification-002',

              status:
                'RETRYING',

              deliveries: [
                {
                  status:
                    'FAILED',
                },
              ],
            },
          ]);

        prisma.outboxEvent.groupBy
          .mockResolvedValue([]);

        const service =
          new NotificationReconciliationService(
            prisma as never,
          );

        const result =
          await service.audit();

        expect(
          result.retryingNotificationsWithoutActiveOutbox,
        ).toBe(
          1,
        );

        expect(
          result.anomalies[0]?.type,
        ).toBe(
          'RETRYING_WITHOUT_ACTIVE_OUTBOX',
        );
      },
    );

    it(
      'reports SENT without SENT delivery',
      async () => {
        const prisma =
          createPrismaMock();

        prisma.notificationDelivery.findMany
          .mockResolvedValue([]);

        prisma.notification.findMany
          .mockResolvedValue([
            {
              id:
                'db-notification-003',

              notificationId:
                'notification-003',

              status:
                'SENT',

              deliveries: [
                {
                  status:
                    'FAILED',
                },
              ],
            },
          ]);

        prisma.outboxEvent.groupBy
          .mockResolvedValue([]);

        const service =
          new NotificationReconciliationService(
            prisma as never,
          );

        const result =
          await service.audit();

        expect(
          result.sentNotificationsWithoutSentDelivery,
        ).toBe(
          1,
        );

        expect(
          result.anomalies[0]?.type,
        ).toBe(
          'SENT_WITHOUT_SENT_DELIVERY',
        );
      },
    );

    it(
      'recovers only PROCESSING deliveries that are stale',
      async () => {
        const prisma =
          createPrismaMock();

        prisma.notificationDelivery.findMany
          .mockResolvedValue([
            {
              id:
                'delivery-stale-001',
            },

            {
              id:
                'delivery-stale-002',
            },
          ]);

        prisma.notificationDelivery.updateMany
          .mockResolvedValue({
            count:
              2,
          });

        const service =
          new NotificationReconciliationService(
            prisma as never,
          );

        const result =
          await service.recoverStaleProcessing({
            staleAfterSeconds:
              300,

            limit:
              100,
          });

        expect(
          result.scanned,
        ).toBe(
          2,
        );

        expect(
          result.recovered,
        ).toBe(
          2,
        );

        expect(
          result.deliveryIds,
        ).toEqual([
          'delivery-stale-001',
          'delivery-stale-002',
        ]);

        expect(
          prisma.notificationDelivery.updateMany,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where:
              expect.objectContaining({
                status:
                  'PROCESSING',
              }),

            data:
              expect.objectContaining({
                status:
                  'FAILED',
              }),
          }),
        );
      },
    );

    it(
      'does not mutate anything when no stale delivery exists',
      async () => {
        const prisma =
          createPrismaMock();

        prisma.notificationDelivery.findMany
          .mockResolvedValue([]);

        const service =
          new NotificationReconciliationService(
            prisma as never,
          );

        const result =
          await service.recoverStaleProcessing();

        expect(
          result.scanned,
        ).toBe(
          0,
        );

        expect(
          result.recovered,
        ).toBe(
          0,
        );

        expect(
          result.deliveryIds,
        ).toEqual(
          [],
        );

        expect(
          prisma.notificationDelivery.updateMany,
        ).not.toHaveBeenCalled();
      },
    );
  },
);