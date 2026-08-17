import {
  PrismaClient,
} from '@gurusthalam/database';

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
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class NotificationDeliveryPersistenceService {
  constructor(
    private readonly prisma:
      PrismaClient,
  ) {}

  async getByDeliveryKey(
    deliveryKey: string,
  ): Promise<NotificationDeliveryRecord | null> {
    const delivery =
      await this.prisma.notificationDelivery.findUnique({
        where: {
          deliveryKey,
        },
      });

    if (!delivery) {
      return null;
    }

    return this.toRecord(
      delivery,
    );
  }

  async createIfMissing(
    notificationId: string,
    deliveryKey: string,
    provider: string,
    channel:
      | 'EMAIL'
      | 'IN_APP'
      | 'PUSH',
  ): Promise<NotificationDeliveryRecord> {
    const delivery =
      await this.prisma.notificationDelivery.upsert({
        where: {
          deliveryKey,
        },

        create: {
          notificationId,
          deliveryKey,
          provider,
          channel,
          status:
            'PENDING',
          attempts: 0,
        },

        update: {},
      });

    return this.toRecord(
      delivery,
    );
  }

  async markProcessing(
    deliveryKey: string,
    attempt: number,
  ): Promise<void> {
    await this.prisma.notificationDelivery.update({
      where: {
        deliveryKey,
      },

      data: {
        status:
          'PROCESSING',

        attempts:
          attempt,

        lastAttemptAt:
          new Date(),

        failedAt:
          null,

        failureReason:
          null,
      },
    });
  }

  async markSent(
    deliveryKey: string,
    providerMessageId: string,
  ): Promise<void> {
    await this.prisma.notificationDelivery.update({
      where: {
        deliveryKey,
      },

      data: {
        status:
          'SENT',

        providerMessageId,

        sentAt:
          new Date(),

        failedAt:
          null,

        failureReason:
          null,
      },
    });
  }

  async markFailed(
    deliveryKey: string,
    reason: string,
  ): Promise<void> {
    await this.prisma.notificationDelivery.update({
      where: {
        deliveryKey,
      },

      data: {
        status:
          'FAILED',

        failedAt:
          new Date(),

        failureReason:
          reason,
      },
    });
  }

  private toRecord(
    delivery: {
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
      readonly createdAt: Date;
      readonly updatedAt: Date;
    },
  ): NotificationDeliveryRecord {
    return {
      id:
        delivery.id,

      notificationId:
        delivery.notificationId,

      deliveryKey:
        delivery.deliveryKey,

      provider:
        delivery.provider,

      channel:
        String(
          delivery.channel,
        ),

      status:
        String(
          delivery.status,
        ),

      attempts:
        delivery.attempts,

      providerMessageId:
        delivery.providerMessageId,

      lastAttemptAt:
        delivery.lastAttemptAt,

      sentAt:
        delivery.sentAt,

      failedAt:
        delivery.failedAt,

      failureReason:
        delivery.failureReason,

      createdAt:
        delivery.createdAt,

      updatedAt:
        delivery.updatedAt,
    };
  }
}