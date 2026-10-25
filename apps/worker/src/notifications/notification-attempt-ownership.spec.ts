import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@gurusthalam/database';
import { NotificationDeliveryPersistenceService } from './notification-delivery-persistence.service.js';
import { NotificationPersistenceService } from './notification-persistence.service.js';
import { NotificationAttemptOwnershipLostError } from './notification-attempt-ownership.error.js';
import { NOTIFICATION_ATTEMPT_LEASE_MS } from './notification-attempt-lease.js';
import type { NotificationJobData } from '../processors/notification.processor.js';

afterEach(() => vi.useRealTimers());

describe('notification attempt ownership guards', () => {
  it('does not mark a delivery sent when the token no longer owns it', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const prisma = {
      notificationDelivery: { updateMany },
    } as unknown as PrismaClient;
    const persistence = new NotificationDeliveryPersistenceService(prisma);

    await expect(
      persistence.markSent('delivery-key', 'stale-token', 'provider-message'),
    ).rejects.toBeInstanceOf(NotificationAttemptOwnershipLostError);

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        deliveryKey: 'delivery-key',
        activeAttemptToken: 'stale-token',
        status: 'PROCESSING',
      },
      data: expect.objectContaining({
        status: 'SENT',
        activeAttemptToken: null,
      }),
    });
  });

  it('does not mark a parent notification failed when the token no longer owns it', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const prisma = { notification: { updateMany } } as unknown as PrismaClient;
    const persistence = new NotificationPersistenceService(prisma);

    await expect(
      persistence.markFailed(
        'notification-1',
        'stale-token',
        'late failure',
        2,
      ),
    ).rejects.toBeInstanceOf(NotificationAttemptOwnershipLostError);

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        notificationId: 'notification-1',
        activeAttemptToken: 'stale-token',
        status: 'PROCESSING',
      },
      data: expect.objectContaining({
        status: 'FAILED',
        activeAttemptToken: null,
      }),
    });
  });

  it('allows an atomic reclaim of a parent whose processing lease expired', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-23T12:00:00.000Z'));

    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = { notification: { updateMany } } as unknown as PrismaClient;
    const persistence = new NotificationPersistenceService(prisma);

    await persistence.markProcessing(
      { notificationId: 'notification-1' } as NotificationJobData,
      3,
      'new-token',
    );

    expect(updateMany).toHaveBeenCalledOnce();

    const args = updateMany.mock.calls[0]?.[0];
    if (args === undefined) {
      throw new Error('Expected updateMany to be called with claim arguments');
    }

    expect(args.where.OR).toEqual([
      { activeAttemptToken: null },
      {
        status: 'PROCESSING',
        activeAttemptToken: { not: null },
        processingAt: {
          lte: new Date(Date.now() - NOTIFICATION_ATTEMPT_LEASE_MS),
        },
      },
    ]);

    expect(args.data).toEqual(
      expect.objectContaining({
        activeAttemptToken: 'new-token',
        status: 'PROCESSING',
      }),
    );
  });

  it('allows an atomic reclaim of a delivery whose processing lease expired', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-23T12:00:00.000Z'));

    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      notificationDelivery: { updateMany },
    } as unknown as PrismaClient;
    const persistence = new NotificationDeliveryPersistenceService(prisma);

    await persistence.markProcessing('delivery-key', 3, 'new-token');

    expect(updateMany).toHaveBeenCalledOnce();

    const args = updateMany.mock.calls[0]?.[0];
    if (args === undefined) {
      throw new Error('Expected updateMany to be called with claim arguments');
    }

    expect(args.where.OR).toEqual([
      { activeAttemptToken: null },
      {
        status: 'PROCESSING',
        activeAttemptToken: { not: null },
        lastAttemptAt: {
          lte: new Date(Date.now() - NOTIFICATION_ATTEMPT_LEASE_MS),
        },
      },
    ]);

    expect(args.data).toEqual(
      expect.objectContaining({
        activeAttemptToken: 'new-token',
        status: 'PROCESSING',
      }),
    );
  });

  it('does not reclaim an already-sent delivery', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const prisma = {
      notificationDelivery: { updateMany },
    } as unknown as PrismaClient;
    const persistence = new NotificationDeliveryPersistenceService(prisma);

    await expect(
      persistence.markProcessing('already-sent', 3, 'new-token'),
    ).rejects.toBeInstanceOf(NotificationAttemptOwnershipLostError);

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deliveryKey: 'already-sent',
          providerSubmissionStartedAt: null,
          status: {
            notIn: ['SENT', 'ACCEPTANCE_UNKNOWN'],
          },
          OR: expect.arrayContaining([
            expect.objectContaining({
              activeAttemptToken: null,
            }),
            expect.objectContaining({
              activeAttemptToken: {
                not: null,
              },
              lastAttemptAt: expect.objectContaining({
                lte: expect.any(Date),
              }),
              status: 'PROCESSING',
            }),
          ]),
        }),
        data: expect.objectContaining({
          activeAttemptToken: 'new-token',
          status: 'PROCESSING',
        }),
      }),
    );
  });

  it('does not reclaim an already-sent parent notification', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const prisma = { notification: { updateMany } } as unknown as PrismaClient;
    const persistence = new NotificationPersistenceService(prisma);

    await expect(
      persistence.markProcessing(
        { notificationId: 'notification-1' } as NotificationJobData,
        3,
        'new-token',
      ),
    ).rejects.toBeInstanceOf(NotificationAttemptOwnershipLostError);

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          notificationId: 'notification-1',
          status: {
            notIn: ['SENT', 'ACCEPTANCE_UNKNOWN'],
          },
        }),
        data: expect.objectContaining({
          activeAttemptToken: 'new-token',
          status: 'PROCESSING',
        }),
      }),
    );
  });

  it('rolls back a primary claim when delivery ownership cannot be acquired', async () => {
    const parentUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const deliveryUpdateMany = vi.fn().mockResolvedValue({ count: 0 });
    const transaction = vi.fn(
      async (callback: (tx: unknown) => Promise<void>) =>
        callback({
          notification: { updateMany: parentUpdateMany },
          notificationDelivery: { updateMany: deliveryUpdateMany },
        }),
    );
    const prisma = { $transaction: transaction } as unknown as PrismaClient;
    const persistence = new NotificationPersistenceService(prisma);

    await expect(
      persistence.claimPrimaryAttempt(
        { notificationId: 'notification-transaction' } as NotificationJobData,
        'delivery-transaction',
        1,
        'parent-token',
        'delivery-token',
      ),
    ).rejects.toBeInstanceOf(NotificationAttemptOwnershipLostError);

    expect(transaction).toHaveBeenCalledOnce();
    expect(parentUpdateMany).toHaveBeenCalledOnce();
    expect(deliveryUpdateMany).toHaveBeenCalledOnce();
  });

  it('does not reconcile a parent from a sent delivery unless its ownership is available or stale', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const prisma = { notification: { updateMany } } as unknown as PrismaClient;
    const persistence = new NotificationPersistenceService(prisma);

    await persistence.reconcileSentFromDelivery(
      'notification-live-owner',
      'development-email',
      'provider-message',
    );

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          notificationId: 'notification-live-owner',
          status: {
            notIn: ['SENT', 'ACCEPTANCE_UNKNOWN'],
          },
          OR: expect.arrayContaining([
            { activeAttemptToken: null },
            expect.objectContaining({
              status: 'PROCESSING',
              activeAttemptToken: { not: null },
            }),
          ]),
        }),
        data: expect.objectContaining({
          status: 'SENT',
          activeAttemptToken: null,
        }),
      }),
    );
  });
});
