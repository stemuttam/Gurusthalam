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
  NotificationReconciliationService,
} from './notification-reconciliation.service.js';

const prefix =
  `phase-3-2-11-reconciliation-${randomUUID()}`;

describe(
  'NotificationReconciliationService - PostgreSQL integration',
  () => {
    let prisma:
      PrismaService;

    let service:
      NotificationReconciliationService;

    beforeAll(
      async () => {
        prisma =
          new PrismaService();

        await prisma.$connect();

        service =
          new NotificationReconciliationService(
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
      'detects and recovers a stale PROCESSING delivery',
      async () => {
        const notificationId =
          `${prefix}-notification`;

        const userId =
          `${prefix}-user`;

        const idempotencyKey =
          `${prefix}-idempotency`;

        const notification =
          await prisma.notification.create({
            data: {
              notificationId,

              userId,

              channel:
                'EMAIL',

              status:
                'PROCESSING',

              body:
                'Phase 3.2.11 reconciliation integration test.',

              idempotencyKey,

              attempts:
                1,

              processingAt:
                new Date(
                  Date.now() -
                    15 *
                      60 *
                      1000,
                ),
            },
          });

        const delivery =
          await prisma.notificationDelivery.create({
            data: {
              notificationId,

              deliveryKey:
                `${prefix}-delivery`,

              provider:
                'integration-test',

              channel:
                'EMAIL',

              status:
                'PROCESSING',

              attempts:
                1,

              lastAttemptAt:
                new Date(
                  Date.now() -
                    15 *
                      60 *
                      1000,
                ),
            },
          });

        try {
          const audit =
            await service.audit({
              staleAfterSeconds:
                300,

              limit:
                100,
            });

          expect(
            audit.staleProcessingDeliveries,
          ).toBeGreaterThanOrEqual(
            1,
          );

          expect(
            audit.anomalies.some(
              (
                anomaly,
              ) =>
                anomaly.notificationId ===
                  notificationId &&
                (
                  anomaly.type ===
                    'STALE_PROCESSING_DELIVERY' ||
                  anomaly.type ===
                    'PROCESSING_WITHOUT_ATTEMPT_TIMESTAMP'
                ),
            ),
          ).toBe(
            true,
          );

          const recovery =
            await service.recoverStaleProcessing({
              staleAfterSeconds:
                300,

              limit:
                100,
            });

          expect(
            recovery.recovered,
          ).toBeGreaterThanOrEqual(
            1,
          );

          const recovered =
            await prisma.notificationDelivery.findUnique({
              where: {
                id:
                  delivery.id,
              },
            });

          expect(
            recovered?.status,
          ).toBe(
            'FAILED',
          );

          expect(
            recovered?.failureReason,
          ).toMatch(
            /Recovered stale PROCESSING delivery/,
          );

          const parent =
            await prisma.notification.findUnique({
              where: {
                id:
                  notification.id,
              },
            });

          /*
           * Reconciliation deliberately does not silently mutate
           * the parent Notification. Operators can inspect and then
           * choose retry/recovery explicitly.
           */
          expect(
            parent?.status,
          ).toBe(
            'PROCESSING',
          );
        } finally {
          await prisma.notificationDelivery.deleteMany({
            where: {
              notificationId,
            },
          });

          await prisma.notification.deleteMany({
            where: {
              id:
                notification.id,
            },
          });
        }
      },
    );

    it(
      'detects RETRYING notifications without active outbox events',
      async () => {
        const notificationId =
          `${prefix}-retrying-notification`;

        const notification =
          await prisma.notification.create({
            data: {
              notificationId,

              userId:
                `${prefix}-retrying-user`,

              channel:
                'EMAIL',

              status:
                'RETRYING',

              body:
                'Retrying consistency audit.',

              idempotencyKey:
                `${prefix}-retrying-idempotency`,

              attempts:
                2,

              processingAt:
                new Date(),
            },
          });

        try {
          const result =
            await service.audit({
              limit:
                1000,
            });

          expect(
            result.retryingNotificationsWithoutActiveOutbox,
          ).toBeGreaterThanOrEqual(
            1,
          );

          expect(
            result.anomalies.some(
              (
                anomaly,
              ) =>
                anomaly.notificationId ===
                  notificationId &&
                anomaly.type ===
                  'RETRYING_WITHOUT_ACTIVE_OUTBOX',
            ),
          ).toBe(
            true,
          );
        } finally {
          await prisma.notification.deleteMany({
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