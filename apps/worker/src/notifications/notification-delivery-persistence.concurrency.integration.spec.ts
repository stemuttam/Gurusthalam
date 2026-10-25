import { randomUUID } from 'node:crypto';

import { createPrismaClient, type PrismaClient } from '@gurusthalam/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { NotificationAttemptOwnershipLostError } from './notification-attempt-ownership.error.js';
import { NOTIFICATION_ATTEMPT_LEASE_MS } from './notification-attempt-lease.js';
import { NotificationDeliveryPersistenceService } from './notification-delivery-persistence.service.js';

describe('NotificationDeliveryPersistenceService concurrency - PostgreSQL integration', () => {
  let prisma: PrismaClient;
  let deliveryPersistence: NotificationDeliveryPersistenceService;

  const suffix = randomUUID();
  const notificationId = `p1-6-submission-marker-${suffix}`;
  const deliveryKey = `p1-6-submission-marker-delivery-${suffix}`;
  const originalOwner = `p1-6-owner-a-${suffix}`;
  const competingOwner = `p1-6-owner-b-${suffix}`;

  beforeAll(async () => {
    prisma = createPrismaClient();
    await prisma.$connect();
    deliveryPersistence = new NotificationDeliveryPersistenceService(prisma);

    await prisma.notification.create({
      data: {
        notificationId,
        userId: `p1-6-user-${suffix}`,
        channel: 'EMAIL',
        status: 'QUEUED',
        subject: 'P1-6 submission marker concurrency test',
        title: 'P1-6 submission marker concurrency test',
        body: 'A provider submission marker must prevent stale lease reclamation.',
        template: null,
        idempotencyKey: `p1-6-idempotency-${suffix}`,
        attempts: 0,
        queuedAt: new Date(),
        processingAt: null,
        sentAt: null,
        provider: 'development-email',
        providerMessageId: null,
        failedAt: null,
        failureReason: null,
      },
    });

    await deliveryPersistence.createIfMissing(
      notificationId,
      deliveryKey,
      'development-email',
      'EMAIL',
    );
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.notification.deleteMany({ where: { notificationId } });
    await prisma.$disconnect();
  });

  it('does not reclaim a stale PROCESSING lease after provider submission has started', async () => {
    await deliveryPersistence.markProcessing(deliveryKey, 1, originalOwner);
    await deliveryPersistence.markProviderSubmissionStarted(deliveryKey, originalOwner);

    // Simulate a worker that stopped making progress after the durable
    // external-side-effect boundary. This does not imply provider rejection.
    await prisma.notificationDelivery.update({
      where: { deliveryKey },
      data: {
        lastAttemptAt: new Date(Date.now() - NOTIFICATION_ATTEMPT_LEASE_MS - 5_000),
      },
    });

    await expect(
      deliveryPersistence.markProcessing(deliveryKey, 2, competingOwner),
    ).rejects.toBeInstanceOf(NotificationAttemptOwnershipLostError);

    const persisted = await prisma.notificationDelivery.findUniqueOrThrow({
      where: { deliveryKey },
    });

    expect(persisted.status).toBe('PROCESSING');
    expect(persisted.attempts).toBe(1);
    expect(persisted.activeAttemptToken).toBe(originalOwner);
    expect(persisted.providerSubmissionStartedAt).toBeInstanceOf(Date);
  });
});
