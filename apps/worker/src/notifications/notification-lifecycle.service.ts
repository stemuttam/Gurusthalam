import {
  PrismaClient,
} from '@gurusthalam/database';

export type NotificationLifecycleStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'RETRYING'
  | 'SENT'
  | 'FAILED';

export class NotificationLifecycleService {
  constructor(
    private readonly prisma:
      PrismaClient,
  ) {}

  async markProcessing(
    notificationId: string,
    attempt: number,
  ): Promise<void> {
    await this.prisma.notification.update({
      where: {
        notificationId,
      },

      data: {
        status:
          'PROCESSING',

        attempts:
          attempt,

        processingAt:
          new Date(),

        failedAt:
          null,

        failureReason:
          null,
      },
    });
  }

  async markRetrying(
    notificationId: string,
    attempt: number,
    reason: string,
  ): Promise<void> {
    await this.prisma.notification.update({
      where: {
        notificationId,
      },

      data: {
        status:
          'RETRYING',

        attempts:
          attempt,

        failureReason:
          reason,

        failedAt:
          null,
      },
    });
  }

  async markSent(
    notificationId: string,
    provider: string,
    providerMessageId: string,
  ): Promise<void> {
    await this.prisma.notification.update({
      where: {
        notificationId,
      },

      data: {
        status:
          'SENT',

        provider,

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
    notificationId: string,
    attempt: number,
    reason: string,
  ): Promise<void> {
    await this.prisma.notification.update({
      where: {
        notificationId,
      },

      data: {
        status:
          'FAILED',

        attempts:
          attempt,

        failedAt:
          new Date(),

        failureReason:
          reason,
      },
    });
  }
}