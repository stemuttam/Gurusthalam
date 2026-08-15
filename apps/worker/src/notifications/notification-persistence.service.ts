import {
  PrismaClient,
} from '@gurusthalam/database';

import type {
  NotificationJobData,
} from '../processors/notification.processor.js';

export class NotificationPersistenceService {
  constructor(
    private readonly prisma: PrismaClient,
  ) {}

  async markProcessing(
    notification: NotificationJobData,
    attempt: number,
  ): Promise<void> {
    await this.prisma.notification.update({
      where: {
        notificationId:
          notification.notificationId,
      },
      data: {
        status: 'PROCESSING',
        attempts: attempt,
        processingAt: new Date(),
        failedAt: null,
        failureReason: null,
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
        status: 'SENT',
        provider,
        providerMessageId,
        sentAt: new Date(),
        failedAt: null,
        failureReason: null,
      },
    });
  }

  async markRetrying(
    notificationId: string,
    reason: string,
    attempt: number,
  ): Promise<void> {
    await this.prisma.notification.update({
      where: {
        notificationId,
      },
      data: {
        status: 'RETRYING',
        attempts: attempt,
        failureReason: reason,
        failedAt: null,
      },
    });
  }

  async markFailed(
    notificationId: string,
    reason: string,
    attempt: number,
  ): Promise<void> {
    await this.prisma.notification.update({
      where: {
        notificationId,
      },
      data: {
        status: 'FAILED',
        attempts: attempt,
        failedAt: new Date(),
        failureReason: reason,
      },
    });
  }
}