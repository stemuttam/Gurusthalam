import { PrismaClient, type Prisma } from '@gurusthalam/database';
import type { NotificationJobData } from '../processors/notification.processor.js';
import { NotificationAttemptOwnershipLostError } from './notification-attempt-ownership.error.js';
import { NOTIFICATION_ATTEMPT_LEASE_MS } from './notification-attempt-lease.js';

export class NotificationPersistenceService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Claims the parent notification and its primary delivery in one transaction.
   * Any failed claim throws inside the transaction, rolling back both updates.
   */
  async claimPrimaryAttempt(
    notification: NotificationJobData,
    deliveryKey: string,
    attempt: number,
    parentOwnershipToken: string,
    deliveryOwnershipToken: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const now = new Date();
      const staleBefore = new Date(
        now.getTime() - NOTIFICATION_ATTEMPT_LEASE_MS,
      );
      const parent = await tx.notification.updateMany({
        where: {
          notificationId: notification.notificationId,
          status: { not: 'SENT' },
          OR: [
            { activeAttemptToken: null },
            {
              status: 'PROCESSING',
              activeAttemptToken: { not: null },
              processingAt: { lte: staleBefore },
            },
          ],
        },
        data: {
          status: 'PROCESSING',
          attempts: attempt,
          processingAt: now,
          failedAt: null,
          failureReason: null,
          activeAttemptToken: parentOwnershipToken,
        },
      });
      if (parent.count !== 1) {
        throw new NotificationAttemptOwnershipLostError(
          'notification',
          notification.notificationId,
        );
      }

      const delivery = await tx.notificationDelivery.updateMany({
        where: {
          deliveryKey,
          status: { not: 'SENT' },
          OR: [
            { activeAttemptToken: null },
            {
              status: 'PROCESSING',
              activeAttemptToken: { not: null },
              lastAttemptAt: { lte: staleBefore },
            },
          ],
        },
        data: {
          status: 'PROCESSING',
          attempts: attempt,
          activeAttemptToken: deliveryOwnershipToken,
          lastAttemptAt: now,
          failedAt: null,
          failureReason: null,
        },
      });
      if (delivery.count !== 1) {
        throw new NotificationAttemptOwnershipLostError(
          'delivery',
          deliveryKey,
        );
      }
    });
  }

  /**
   * Repairs a non-replay parent from a durable successful delivery, but only
   * when no live attempt owns the parent. A live PROCESSING token is never
   * overwritten; an expired processing lease may be safely reconciled.
   */
  async reconcileSentFromDelivery(
    notificationId: string,
    provider: string,
    providerMessageId: string,
  ): Promise<void> {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - NOTIFICATION_ATTEMPT_LEASE_MS);
    await this.prisma.notification.updateMany({
      where: {
        notificationId,
        status: { not: 'SENT' },
        OR: [
          { activeAttemptToken: null },
          {
            status: 'PROCESSING',
            activeAttemptToken: { not: null },
            processingAt: { lte: staleBefore },
          },
        ],
      },
      data: {
        status: 'SENT',
        provider,
        providerMessageId,
        sentAt: now,
        failedAt: null,
        failureReason: null,
        activeAttemptToken: null,
      },
    });
  }

  /** Atomically claims the parent notification unless it is already terminally sent. */
  async markProcessing(
    notification: NotificationJobData,
    attempt: number,
    ownershipToken: string,
  ): Promise<void> {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - NOTIFICATION_ATTEMPT_LEASE_MS);
    const result = await this.prisma.notification.updateMany({
      where: {
        notificationId: notification.notificationId,
        status: { not: 'SENT' },
        OR: [
          { activeAttemptToken: null },
          {
            status: 'PROCESSING',
            activeAttemptToken: { not: null },
            processingAt: { lte: staleBefore },
          },
        ],
      },
      data: {
        status: 'PROCESSING',
        attempts: attempt,
        processingAt: now,
        failedAt: null,
        failureReason: null,
        activeAttemptToken: ownershipToken,
      },
    });
    if (result.count !== 1)
      throw new NotificationAttemptOwnershipLostError(
        'notification',
        notification.notificationId,
      );
  }

  async markSent(
    notificationId: string,
    ownershipToken: string,
    provider: string,
    providerMessageId: string,
  ): Promise<void> {
    const result = await this.prisma.notification.updateMany({
      where: {
        notificationId,
        activeAttemptToken: ownershipToken,
        status: 'PROCESSING',
      },
      data: {
        status: 'SENT',
        provider,
        providerMessageId,
        sentAt: new Date(),
        failedAt: null,
        failureReason: null,
        activeAttemptToken: null,
      },
    });
    if (result.count !== 1)
      throw new NotificationAttemptOwnershipLostError(
        'notification',
        notificationId,
      );
  }

  async markRetrying(
    notificationId: string,
    ownershipToken: string,
    reason: string,
    attempt: number,
  ): Promise<void> {
    const result = await this.prisma.notification.updateMany({
      where: {
        notificationId,
        activeAttemptToken: ownershipToken,
        status: 'PROCESSING',
      },
      data: {
        status: 'RETRYING',
        attempts: attempt,
        failureReason: reason,
        failedAt: null,
        activeAttemptToken: null,
      },
    });
    if (result.count !== 1)
      throw new NotificationAttemptOwnershipLostError(
        'notification',
        notificationId,
      );
  }

  async markFailed(
    notificationId: string,
    ownershipToken: string,
    reason: string,
    attempt: number,
  ): Promise<void> {
    const result = await this.prisma.notification.updateMany({
      where: {
        notificationId,
        activeAttemptToken: ownershipToken,
        status: 'PROCESSING',
      },
      data: {
        status: 'FAILED',
        attempts: attempt,
        failedAt: new Date(),
        failureReason: reason,
        activeAttemptToken: null,
      },
    });
    if (result.count !== 1)
      throw new NotificationAttemptOwnershipLostError(
        'notification',
        notificationId,
      );
  }
}
