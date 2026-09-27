import { randomUUID } from 'node:crypto';

import { createPrismaClient, type PrismaClient } from '@gurusthalam/database';

import type { Job } from 'bullmq';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  NotificationProcessor,
  type NotificationJobData,
} from './notification.processor.js';

import { NotificationPersistenceService } from '../notifications/notification-persistence.service.js';

import { NotificationDeliveryPersistenceService } from '../notifications/notification-delivery-persistence.service.js';

import { createNotificationDeliveryKey } from '../notifications/notification-delivery-key.js';

import { EmailNotificationProvider } from '../providers/notification/email-notification.provider.js';

import { InAppNotificationProvider } from '../providers/notification/in-app-notification.provider.js';

import { PushNotificationProvider } from '../providers/notification/push-notification.provider.js';

import { NotificationProviderRegistry } from '../providers/notification/notification-provider.registry.js';

import { NotificationIdempotencyService } from '../providers/notification/notification-idempotency.service.js';

import { NotificationProviderFailureSimulator } from '../providers/notification/notification-provider.failure-simulator.js';

type DeliveryCase = {
  readonly channel: 'email' | 'in-app' | 'push';

  readonly databaseChannel: 'EMAIL' | 'IN_APP' | 'PUSH';

  readonly provider:
    'development-email' | 'development-in-app' | 'development-push';

  readonly expectedMessageId: (
    notificationId: string,
    deliveryKey: string,
  ) => string;

  readonly recipient: NotificationJobData['recipient'];
};

describe('NotificationProcessor - production provider delivery integration', () => {
  let prisma: PrismaClient;

  let persistence: NotificationPersistenceService;

  let deliveryPersistence: NotificationDeliveryPersistenceService;

  let notificationIdempotency: NotificationIdempotencyService;

  let processor: NotificationProcessor;

  const logger = {
    info: () => undefined,

    warn: () => undefined,

    error: () => undefined,
  };

  const metrics = {
    incrementProcessing: () => undefined,

    incrementIdempotentHits: () => undefined,

    incrementProviderIdempotentHits: () => undefined,

    incrementSent: () => undefined,

    incrementProviderSent: () => undefined,

    incrementRetrying: () => undefined,

    incrementProviderRetrying: () => undefined,

    incrementFailed: () => undefined,

    incrementProviderFailed: () => undefined,

    incrementProviderErrorsFor: () => undefined,

    recordLatency: () => undefined,

    recordProviderLatency: () => undefined,

    incrementFallbackStarted: () => undefined,

    incrementFallbackAttempts: () => undefined,

    incrementFallbackAttemptFailures: () => undefined,

    incrementFallbackRecovered: () => undefined,

    incrementFallbackExhausted: () => undefined,

    incrementFallbackIdempotentHits: () => undefined,
  };

  const deliveryCases: readonly DeliveryCase[] = [
    {
      channel: 'email',

      databaseChannel: 'EMAIL',

      provider: 'development-email',

      expectedMessageId: (_notificationId, deliveryKey) =>
        `dev-email-${deliveryKey}`,

      recipient: {
        userId: `4-13-d-email-user-${randomUUID()}`,

        email: `4-13-d-${randomUUID()}@gurusthalam.local`,
      },
    },

    {
      channel: 'in-app',

      databaseChannel: 'IN_APP',

      provider: 'development-in-app',

      expectedMessageId: (notificationId) => `dev-in-app-${notificationId}`,

      recipient: {
        userId: `4-13-d-in-app-user-${randomUUID()}`,
      },
    },

    {
      channel: 'push',

      databaseChannel: 'PUSH',

      provider: 'development-push',

      expectedMessageId: (notificationId) => `dev-push-${notificationId}`,

      recipient: {
        userId: `4-13-d-push-user-${randomUUID()}`,
      },
    },
  ];

  const createdNotificationIds: string[] = [];

  beforeAll(async () => {
    prisma = createPrismaClient();

    await prisma.$connect();

    persistence = new NotificationPersistenceService(prisma);

    deliveryPersistence = new NotificationDeliveryPersistenceService(prisma);

    notificationIdempotency = new NotificationIdempotencyService();

    const emailProvider = new EmailNotificationProvider(
      logger as never,

      notificationIdempotency,
    );

    const inAppProvider = new InAppNotificationProvider(logger as never);

    const pushProvider = new PushNotificationProvider(logger as never);

    /*
     * The integration test deliberately disables
     * failure simulation so this suite validates the
     * genuine successful production provider path.
     */
    const failureSimulator = new NotificationProviderFailureSimulator({
      mode: 'disabled',
    });

    const providerRegistry = new NotificationProviderRegistry(
      emailProvider,

      inAppProvider,

      pushProvider,

      failureSimulator,
    );

    processor = new NotificationProcessor(
      logger as never,

      providerRegistry,

      persistence,

      deliveryPersistence,

      metrics as never,
    );
  });

  afterAll(async () => {
    if (createdNotificationIds.length > 0) {
      await prisma.notification.deleteMany({
        where: {
          notificationId: {
            in: createdNotificationIds,
          },
        },
      });
    }

    await notificationIdempotency.close();

    await prisma.$disconnect();
  });

  function createNotification(deliveryCase: DeliveryCase): NotificationJobData {
    const notificationId = `phase-4-13-d-${deliveryCase.channel}-${randomUUID()}`;

    createdNotificationIds.push(notificationId);

    const base = {
      notificationId,

      channel: deliveryCase.channel,

      recipient: deliveryCase.recipient,

      body: `Production notification delivery integration test for ${deliveryCase.channel}.`,

      idempotencyKey: `${notificationId}-idempotency`,
    };

    if (deliveryCase.channel === 'email') {
      return {
        ...base,

        subject: 'Gurusthalam 4.13-D notification delivery',

        title: 'Notification delivery integration',
      };
    }

    return {
      ...base,

      title: 'Notification delivery integration',
    };
  }

  function createJob(
    notification: NotificationJobData,
  ): Job<NotificationJobData> {
    return {
      id: `job-${notification.notificationId}`,

      attemptsMade: 0,

      data: notification,
    } as unknown as Job<NotificationJobData>;
  }

  for (const deliveryCase of deliveryCases) {
    it(`delivers a real ${deliveryCase.channel} notification through the production provider boundary`, async () => {
      const notification = createNotification(deliveryCase);

      const deliveryKey = createNotificationDeliveryKey(
        notification.notificationId,

        notification.channel,

        deliveryCase.provider,
      );

      await prisma.notification.create({
        data: {
          notificationId: notification.notificationId,

          userId: notification.recipient.userId,

          channel: deliveryCase.databaseChannel,

          status: 'QUEUED',

          subject: notification.subject ?? null,

          title: notification.title ?? null,

          body: notification.body,

          template: notification.template ?? null,

          idempotencyKey: notification.idempotencyKey,

          attempts: 0,

          queuedAt: new Date(),
        },
      });

      const result = await processor.process(createJob(notification));

      const expectedMessageId = deliveryCase.expectedMessageId(
        notification.notificationId,

        deliveryKey,
      );

      expect(result).toEqual({
        processed: true,

        notificationId: notification.notificationId,

        channel: deliveryCase.channel,

        provider: deliveryCase.provider,

        messageId: expectedMessageId,
      });

      const persistedNotification = await prisma.notification.findUnique({
        where: {
          notificationId: notification.notificationId,
        },
      });

      expect(persistedNotification).not.toBeNull();

      expect(persistedNotification).toMatchObject({
        notificationId: notification.notificationId,

        userId: notification.recipient.userId,

        channel: deliveryCase.databaseChannel,

        status: 'SENT',

        provider: deliveryCase.provider,

        providerMessageId: expectedMessageId,

        attempts: 1,
      });

      expect(persistedNotification?.sentAt).toBeInstanceOf(Date);

      const persistedDelivery =
        await deliveryPersistence.getByDeliveryKey(deliveryKey);

      expect(persistedDelivery).not.toBeNull();

      expect(persistedDelivery).toMatchObject({
        notificationId: notification.notificationId,

        deliveryKey,

        provider: deliveryCase.provider,

        channel: deliveryCase.databaseChannel,

        status: 'SENT',

        attempts: 1,

        providerMessageId: expectedMessageId,
      });

      expect(persistedDelivery?.sentAt).toBeInstanceOf(Date);
    });
  }

  it('does not create a second NotificationDelivery when the same delivered notification is processed again', async () => {
    const deliveryCase = deliveryCases[0];

    if (deliveryCase === undefined) {
      throw new Error('4.13-D delivery case fixture is missing.');
    }

    const notification = createNotification(deliveryCase);

    const deliveryKey = createNotificationDeliveryKey(
      notification.notificationId,

      notification.channel,

      deliveryCase.provider,
    );

    await prisma.notification.create({
      data: {
        notificationId: notification.notificationId,

        userId: notification.recipient.userId,

        channel: deliveryCase.databaseChannel,

        status: 'QUEUED',

        subject: notification.subject ?? null,

        title: notification.title ?? null,

        body: notification.body,

        template: notification.template ?? null,

        idempotencyKey: notification.idempotencyKey,

        attempts: 0,

        queuedAt: new Date(),
      },
    });

    const firstResult = await processor.process(createJob(notification));

    const secondResult = await processor.process(createJob(notification));

    const expectedMessageId = deliveryCase.expectedMessageId(
      notification.notificationId,

      deliveryKey,
    );

    expect(firstResult).toEqual(secondResult);

    expect(firstResult.messageId).toBe(expectedMessageId);

    const deliveries = await prisma.notificationDelivery.findMany({
      where: {
        notificationId: notification.notificationId,
      },

      orderBy: {
        createdAt: 'asc',
      },
    });

    expect(deliveries).toHaveLength(1);

    expect(deliveries[0]).toMatchObject({
      notificationId: notification.notificationId,

      deliveryKey,

      provider: deliveryCase.provider,

      channel: deliveryCase.databaseChannel,

      status: 'SENT',

      attempts: 1,

      providerMessageId: expectedMessageId,
    });
  });

  it('preserves the canonical delivery identity independently from the logical notificationId', async () => {
    const deliveryCase = deliveryCases[1];

    if (deliveryCase === undefined) {
      throw new Error('4.13-D delivery case fixture is missing.');
    }

    const notification = createNotification(deliveryCase);

    const deliveryKey = createNotificationDeliveryKey(
      notification.notificationId,

      notification.channel,

      deliveryCase.provider,
    );

    await prisma.notification.create({
      data: {
        notificationId: notification.notificationId,

        userId: notification.recipient.userId,

        channel: deliveryCase.databaseChannel,

        status: 'QUEUED',

        subject: null,

        title: notification.title ?? null,

        body: notification.body,

        template: notification.template ?? null,

        idempotencyKey: notification.idempotencyKey,

        attempts: 0,

        queuedAt: new Date(),
      },
    });

    await processor.process(createJob(notification));

    expect(deliveryKey).not.toBe(notification.notificationId);

    const delivery = await deliveryPersistence.getByDeliveryKey(deliveryKey);

    expect(delivery).not.toBeNull();

    expect(delivery?.deliveryKey).toBe(deliveryKey);

    expect(delivery?.notificationId).toBe(notification.notificationId);

    expect(delivery?.provider).toBe(deliveryCase.provider);

    expect(delivery?.status).toBe('SENT');
  });
});
