import { PrismaClient } from '@gurusthalam/database';
import { NotificationAttemptOwnershipLostError } from './notification-attempt-ownership.error.js';
import { NOTIFICATION_ATTEMPT_LEASE_MS } from './notification-attempt-lease.js';

export interface NotificationDeliveryRecord {
  readonly id: string;
  readonly notificationId: string;
  readonly deliveryKey: string;
  readonly provider: string;
  readonly channel: string;
  readonly status: string;
  readonly attempts: number;
  readonly providerMessageId: string | null;
  readonly lastAttemptAt: Date | null;
  readonly sentAt: Date | null;
  readonly failedAt: Date | null;
  readonly failureReason: string | null;
  readonly activeAttemptToken: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class NotificationDeliveryPersistenceService {
  constructor(private readonly prisma: PrismaClient) {}

  async getByDeliveryKey(
    deliveryKey: string,
  ): Promise<NotificationDeliveryRecord | null> {
    const delivery = await this.prisma.notificationDelivery.findUnique({
      where: { deliveryKey },
    });
    return delivery ? this.toRecord(delivery) : null;
  }

  async createIfMissing(
    notificationId: string,
    deliveryKey: string,
    provider: string,
    channel: 'EMAIL' | 'IN_APP' | 'PUSH',
  ): Promise<NotificationDeliveryRecord> {
    const delivery = await this.prisma.notificationDelivery.upsert({
      where: { deliveryKey },
      create: {
        notificationId,
        deliveryKey,
        provider,
        channel,
        status: 'PENDING',
        attempts: 0,
      },
      update: {},
    });
    return this.toRecord(delivery);
  }

  /** Atomically transfers delivery ownership to this attempt. */
  async markProcessing(
    deliveryKey: string,
    attempt: number,
    ownershipToken: string,
  ): Promise<void> {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - NOTIFICATION_ATTEMPT_LEASE_MS);
    const result = await this.prisma.notificationDelivery.updateMany({
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
        activeAttemptToken: ownershipToken,
        lastAttemptAt: now,
        failedAt: null,
        failureReason: null,
      },
    });
    if (result.count !== 1)
      throw new NotificationAttemptOwnershipLostError('delivery', deliveryKey);
  }

  async markSent(
    deliveryKey: string,
    ownershipToken: string,
    providerMessageId: string,
  ): Promise<void> {
    const result = await this.prisma.notificationDelivery.updateMany({
      where: {
        deliveryKey,
        activeAttemptToken: ownershipToken,
        status: 'PROCESSING',
      },
      data: {
        status: 'SENT',
        providerMessageId,
        sentAt: new Date(),
        failedAt: null,
        failureReason: null,
        activeAttemptToken: null,
      },
    });
    if (result.count !== 1)
      throw new NotificationAttemptOwnershipLostError('delivery', deliveryKey);
  }

  async markFailed(
    deliveryKey: string,
    ownershipToken: string,
    reason: string,
  ): Promise<void> {
    const result = await this.prisma.notificationDelivery.updateMany({
      where: {
        deliveryKey,
        activeAttemptToken: ownershipToken,
        status: 'PROCESSING',
      },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        failureReason: reason,
        activeAttemptToken: null,
      },
    });
    if (result.count !== 1)
      throw new NotificationAttemptOwnershipLostError('delivery', deliveryKey);
  }

  private toRecord(delivery: {
    readonly id: string;
    readonly notificationId: string;
    readonly deliveryKey: string;
    readonly provider: string;
    readonly channel: unknown;
    readonly status: unknown;
    readonly attempts: number;
    readonly providerMessageId: string | null;
    readonly lastAttemptAt: Date | null;
    readonly sentAt: Date | null;
    readonly failedAt: Date | null;
    readonly failureReason: string | null;
    readonly activeAttemptToken: string | null;
    readonly createdAt: Date;
    readonly updatedAt: Date;
  }): NotificationDeliveryRecord {
    return {
      id: delivery.id,
      notificationId: delivery.notificationId,
      deliveryKey: delivery.deliveryKey,
      provider: delivery.provider,
      channel: String(delivery.channel),
      status: String(delivery.status),
      attempts: delivery.attempts,
      providerMessageId: delivery.providerMessageId,
      lastAttemptAt: delivery.lastAttemptAt,
      sentAt: delivery.sentAt,
      failedAt: delivery.failedAt,
      failureReason: delivery.failureReason,
      activeAttemptToken: delivery.activeAttemptToken,
      createdAt: delivery.createdAt,
      updatedAt: delivery.updatedAt,
    };
  }
}
