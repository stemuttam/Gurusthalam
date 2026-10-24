import { createPrismaClient, type PrismaClient } from '@gurusthalam/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NotificationJobData } from '../processors/notification.processor.js';
import { NotificationAttemptOwnershipLostError } from './notification-attempt-ownership.error.js';
import { NotificationDeliveryPersistenceService } from './notification-delivery-persistence.service.js';
import { NotificationPersistenceService } from './notification-persistence.service.js';

/** These tests require the worker's configured PostgreSQL database and migrated schema. */
describe('notification primary ownership - PostgreSQL transaction integration', () => {
  let prisma: PrismaClient;
  let persistence: NotificationPersistenceService;
  let deliveryPersistence: NotificationDeliveryPersistenceService;
  const suffix = `ownership-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const notificationId = `${suffix}-notification`;
  const deliveryKey = `${suffix}-delivery`;
  const userId = `${suffix}-user`;
  const notification: NotificationJobData = {
    notificationId,
    channel: 'email',
    recipient: { userId, email: `${suffix}@gurusthalam.local` },
    body: 'Notification ownership transaction integration test',
    idempotencyKey: `${suffix}-idempotency`,
  };

  beforeAll(async () => {
    prisma = createPrismaClient();
    await prisma.$connect();
    persistence = new NotificationPersistenceService(prisma);
    deliveryPersistence = new NotificationDeliveryPersistenceService(prisma);
    await prisma.notification.create({
      data: {
        notificationId,
        userId,
        channel: 'EMAIL',
        status: 'QUEUED',
        body: notification.body,
        idempotencyKey: notification.idempotencyKey,
        attempts: 0,
      },
    });
    await prisma.notificationDelivery.create({
      data: {
        notificationId,
        deliveryKey,
        provider: 'development-email',
        channel: 'EMAIL',
        status: 'PENDING',
        attempts: 0,
      },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.notification.deleteMany({ where: { notificationId } });
    await prisma.$disconnect();
  });

  it('rolls back the parent claim when the delivery claim fails', async () => {
    const occupiedToken = `${suffix}-occupied`;
    await prisma.notificationDelivery.update({
      where: { deliveryKey },
      data: {
        status: 'PROCESSING',
        activeAttemptToken: occupiedToken,
        lastAttemptAt: new Date(),
      },
    });

    await expect(
      persistence.claimPrimaryAttempt(
        notification,
        deliveryKey,
        1,
        `${suffix}-parent-attempt`,
        `${suffix}-delivery-attempt`,
      ),
    ).rejects.toBeInstanceOf(NotificationAttemptOwnershipLostError);

    const parent = await prisma.notification.findUniqueOrThrow({
      where: { notificationId },
    });
    expect(parent.status).toBe('QUEUED');
    expect(parent.activeAttemptToken).toBeNull();

    const delivery = await prisma.notificationDelivery.findUniqueOrThrow({
      where: { deliveryKey },
    });
    expect(delivery.activeAttemptToken).toBe(occupiedToken);

    // Restore the fixture for the concurrency test.
    await prisma.notificationDelivery.update({
      where: { deliveryKey },
      data: {
        status: 'PENDING',
        activeAttemptToken: null,
        lastAttemptAt: null,
      },
    });
  });

  it('allows only one concurrent primary claim and keeps both ownership tokens paired', async () => {
    const attempts = [
      { parent: `${suffix}-parent-a`, delivery: `${suffix}-delivery-a` },
      { parent: `${suffix}-parent-b`, delivery: `${suffix}-delivery-b` },
    ];
    const results = await Promise.allSettled(
      attempts.map((tokens) =>
        persistence.claimPrimaryAttempt(
          notification,
          deliveryKey,
          1,
          tokens.parent,
          tokens.delivery,
        ),
      ),
    );

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);

    const parent = await prisma.notification.findUniqueOrThrow({
      where: { notificationId },
    });
    const delivery = await prisma.notificationDelivery.findUniqueOrThrow({
      where: { deliveryKey },
    });
    const winner = attempts.find(
      (tokens) => tokens.parent === parent.activeAttemptToken,
    );
    expect(winner).toBeDefined();
    expect(parent.status).toBe('PROCESSING');
    expect(delivery.status).toBe('PROCESSING');
    expect(delivery.activeAttemptToken).toBe(winner?.delivery);

    await expect(
      persistence.markSent(
        notificationId,
        `${suffix}-stale-parent-token`,
        'development-email',
        `${suffix}-stale-message`,
      ),
    ).rejects.toBeInstanceOf(NotificationAttemptOwnershipLostError);
    await expect(
      deliveryPersistence.markSent(
        deliveryKey,
        `${suffix}-stale-delivery-token`,
        `${suffix}-stale-message`,
      ),
    ).rejects.toBeInstanceOf(NotificationAttemptOwnershipLostError);

    const parentAfterStaleAttempt = await prisma.notification.findUniqueOrThrow(
      {
        where: { notificationId },
      },
    );
    const deliveryAfterStaleAttempt =
      await prisma.notificationDelivery.findUniqueOrThrow({
        where: { deliveryKey },
      });
    expect(parentAfterStaleAttempt.activeAttemptToken).toBe(winner?.parent);
    expect(deliveryAfterStaleAttempt.activeAttemptToken).toBe(winner?.delivery);
  });
});
