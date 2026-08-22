import {
  createPrismaClient,
  type PrismaClient,
} from '@gurusthalam/database';

import type {
  Job,
} from 'bullmq';

import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  NotificationProcessor,
  type NotificationJobData,
} from './notification.processor.js';

import {
  NotificationPersistenceService,
} from '../notifications/notification-persistence.service.js';

import {
  NotificationDeliveryPersistenceService,
} from '../notifications/notification-delivery-persistence.service.js';

describe(
  'NotificationProcessor delivery idempotency - PostgreSQL integration',
  () => {
    let prisma:
      PrismaClient;

    let persistence:
      NotificationPersistenceService;

    let deliveryPersistence:
      NotificationDeliveryPersistenceService;

    let processor:
      NotificationProcessor;

    const providerSend =
      vi.fn();

    const providerName =
      'development-email';

    const notificationId =
      `phase-3-2-8-db-idempotency-${Date.now()}`;

    const idempotencyKey =
      `${notificationId}-idempotency`;

    const deliveryKey =
      `${notificationId}-delivery`;

    const providerMessageId =
      `${notificationId}-provider-message`;

    const notification:
      NotificationJobData = {
      notificationId,

      channel:
        'email',

      recipient: {
        userId:
          `${notificationId}-user`,

        email:
          `${notificationId}@gurusthalam.local`,
      },

      subject:
        'Phase 3.2.8 integration test',

      title:
        'Delivery idempotency',

      body:
        'PostgreSQL-backed delivery idempotency integration test.',

      idempotencyKey,
    };

    const createJob =
      (): Job<NotificationJobData> =>
        ({
          id:
            `job-${notificationId}`,

          attemptsMade:
            0,

          data: {
            ...notification,

            deliveryKey,
          },
        }) as unknown as Job<
          NotificationJobData
        >;

    beforeAll(
      async () => {
        prisma =
          createPrismaClient();

        await prisma.$connect();

        persistence =
          new NotificationPersistenceService(
            prisma,
          );

        deliveryPersistence =
          new NotificationDeliveryPersistenceService(
            prisma,
          );

        /*
         * Create an isolated notification fixture directly in the
         * same PostgreSQL database used by the production worker.
         */
        await prisma.notification.create({
  data: {
    notificationId,

    userId:
      notification.recipient.userId,

    channel:
      'EMAIL',

    status:
      'SENT',

    subject:
      notification.subject ?? null,

    title:
      notification.title ?? null,

    body:
      notification.body,

    template:
      null,

    idempotencyKey,

    attempts:
      1,

    queuedAt:
      new Date(),

    processingAt:
      new Date(),

    sentAt:
      new Date(),

    provider:
      providerName,

    providerMessageId:
      providerMessageId,

    failedAt:
      null,

    failureReason:
      null,
  },
});

        /*
         * Create the canonical delivery identity and mark it SENT.
         *
         * This mirrors the state of a production notification after
         * successful provider delivery.
         */
        await deliveryPersistence.createIfMissing(
          notificationId,

          deliveryKey,

          providerName,

          'EMAIL',
        );

        await deliveryPersistence.markProcessing(
          deliveryKey,

          1,
        );

        await deliveryPersistence.markSent(
          deliveryKey,

          providerMessageId,
        );

        providerSend.mockResolvedValue({
          accepted:
            true,

          classification:
            'SUCCESS',

          provider:
            providerName,

          messageId:
            `SHOULD-NOT-BE-CALLED`,
        });

        const providerRegistry = {
          get:
            vi.fn(
              () => ({
                send:
                  providerSend,
              }),
            ),
        };

        const metrics = {
          incrementProcessing:
            vi.fn(),

          incrementIdempotentHits:
            vi.fn(),

          incrementProviderIdempotentHits:
            vi.fn(),

          incrementSent:
            vi.fn(),

          incrementProviderSent:
            vi.fn(),

          incrementRetrying:
            vi.fn(),

          incrementProviderRetrying:
            vi.fn(),

          incrementFailed:
            vi.fn(),

          incrementProviderFailed:
            vi.fn(),

          incrementProviderErrorsFor:
            vi.fn(),

          recordLatency:
            vi.fn(),

          recordProviderLatency:
            vi.fn(),
        };

        const logger = {
          info:
            vi.fn(),

          error:
            vi.fn(),

          warn:
            vi.fn(),
        };

        processor =
       new NotificationProcessor(
    logger as never,

    providerRegistry as never,

    persistence,

    deliveryPersistence,

    metrics as never,
     );
      },
    );

    afterAll(
  async () => {
    if (!prisma) {
      return;
    }

    /*
     * NotificationDelivery belongs to Notification and the Prisma
     * relation uses ON DELETE CASCADE.
     *
     * Deleting the fixture Notification therefore removes all
     * NotificationDelivery rows created by this integration test.
     */
    await prisma.notification.deleteMany({
      where: {
        notificationId,
      },
    });

    await prisma.$disconnect();
  },
);

    it(
      'skips the real provider for the same SENT deliveryKey',
      async () => {
        const before =
          await deliveryPersistence.getByDeliveryKey(
            deliveryKey,
          );

        expect(
          before,
        ).not.toBeNull();

        expect(
          before?.status,
        ).toBe(
          'SENT',
        );

        expect(
          before?.providerMessageId,
        ).toBe(
          providerMessageId,
        );

        const result =
          await processor.process(
            createJob(),
          );

        expect(
          providerSend,
        ).not.toHaveBeenCalled();

        expect(
          result,
        ).toEqual({
          processed:
            true,

          notificationId,

          channel:
            'email',

          provider:
            providerName,

          messageId:
            providerMessageId,
        });
      },
    );

    it(
      'preserves the original Notification provider identity after the same-key replay',
      async () => {
        const persisted =
          await prisma.notification.findUnique({
            where: {
              notificationId,
            },
          });

        expect(
          persisted,
        ).not.toBeNull();

        expect(
          persisted?.status,
        ).toBe(
          'SENT',
        );

        expect(
          persisted?.providerMessageId,
        ).toBe(
          providerMessageId,
        );

        expect(
          persisted?.attempts,
        ).toBe(
          1,
        );
      },
    );

    it(
      'does not create another NotificationDelivery for the same deliveryKey',
      async () => {
        const deliveries =
          await prisma.notificationDelivery.findMany({
            where: {
              notificationId,
            },

            orderBy: {
              createdAt:
                'asc',
            },
          });

        expect(
          deliveries,
        ).toHaveLength(
          1,
        );

        expect(
          deliveries[0]?.deliveryKey,
        ).toBe(
          deliveryKey,
        );

        expect(
          deliveries[0]?.status,
        ).toBe(
          'SENT',
        );

        expect(
          deliveries[0]?.providerMessageId,
        ).toBe(
          providerMessageId,
        );

        expect(
          deliveries[0]?.attempts,
        ).toBe(
          1,
        );
      },
    );

    it(
      'preserves the persisted delivery identity and provider message ID',
      async () => {
        const delivery =
          await deliveryPersistence.getByDeliveryKey(
            deliveryKey,
          );

        expect(
          delivery,
        ).not.toBeNull();

        expect(
          delivery?.deliveryKey,
        ).toBe(
          deliveryKey,
        );

        expect(
          delivery?.providerMessageId,
        ).toBe(
          providerMessageId,
        );

        expect(
          delivery?.status,
        ).toBe(
          'SENT',
        );

        expect(
          delivery?.attempts,
        ).toBe(
          1,
        );
      },
    );
  },
);