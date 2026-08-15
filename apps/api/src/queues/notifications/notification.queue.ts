import {
  Injectable,
} from '@nestjs/common';

import {
  PrismaService,
} from '../../database/prisma/prisma.service.js';

import {
  BullMqService,
} from '../bullmq/bullmq.service.js';

import {
  BULLMQ_QUEUE_NAMES,
} from '../bullmq/bullmq.constants.js';

import {
  NOTIFICATION_JOB_OPTIONS,
} from './notification.policy.js';

import type {
  NotificationJobData,
} from './notification.types.js';

export interface NotificationRecord {
  readonly id: string;
  readonly notificationId: string;
  readonly userId: string;
  readonly channel: string;
  readonly status: string;
  readonly subject: string | null;
  readonly title: string | null;
  readonly body: string;
  readonly template: string | null;
  readonly templateData: unknown;
  readonly provider: string | null;
  readonly providerMessageId: string | null;
  readonly idempotencyKey: string;
  readonly attempts: number;
  readonly queuedAt: Date;
  readonly processingAt: Date | null;
  readonly sentAt: Date | null;
  readonly failedAt: Date | null;
  readonly failureReason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NotificationEnqueueResult {
  readonly jobId: string;
  readonly queue: string;
  readonly notificationId: string;
  readonly status: string;
}

@Injectable()
export class NotificationQueueService {
  constructor(
    private readonly bullMq: BullMqService,
    private readonly prisma: PrismaService,
  ) {}

  async enqueue(
    data: NotificationJobData,
  ): Promise<NotificationEnqueueResult> {
    /*
     * ---------------------------------------------------------
     * Idempotency check
     * ---------------------------------------------------------
     */
    const existing =
      await this.prisma.notification.findUnique({
        where: {
          idempotencyKey:
            data.idempotencyKey,
        },
      });

    if (existing) {
      return {
        jobId:
          data.idempotencyKey,

        queue:
          BULLMQ_QUEUE_NAMES.NOTIFICATIONS,

        notificationId:
          existing.notificationId,

        status:
          String(existing.status),
      };
    }

    /*
     * ---------------------------------------------------------
     * Persist notification as QUEUED
     * ---------------------------------------------------------
     *
     * templateData is already strongly typed as JSON-compatible,
     * so Prisma can consume it directly.
     */
    let notification;

    try {
      const createData = {
        notificationId:
          data.notificationId,

        userId:
          data.recipient.userId,

        channel:
          this.toPrismaChannel(
            data.channel,
          ),

        status:
          'QUEUED' as const,

        subject:
          data.subject ?? null,

        title:
          data.title ?? null,

        body:
          data.body,

        template:
          data.template ?? null,

        idempotencyKey:
          data.idempotencyKey,

        attempts:
          0,

        queuedAt:
          new Date(),

        ...(data.templateData !==
        undefined
          ? {
              templateData:
                data.templateData,
            }
          : {}),
      };

      notification =
        await this.prisma.notification.create({
          data: createData,
        });
    } catch (error: unknown) {
      /*
       * -------------------------------------------------------
       * Concurrent idempotency protection
       * -------------------------------------------------------
       */
      const raced =
        await this.prisma.notification.findUnique({
          where: {
            idempotencyKey:
              data.idempotencyKey,
          },
        });

      if (raced) {
        return {
          jobId:
            data.idempotencyKey,

          queue:
            BULLMQ_QUEUE_NAMES.NOTIFICATIONS,

          notificationId:
            raced.notificationId,

          status:
            String(raced.status),
        };
      }

      throw error;
    }

    /*
     * ---------------------------------------------------------
     * Enqueue BullMQ job
     * ---------------------------------------------------------
     */
    try {
      const queue =
        this.bullMq.getQueue(
          BULLMQ_QUEUE_NAMES.NOTIFICATIONS,
        );

      const job =
        await queue.add(
          `notification:${data.channel}`,
          data,
          {
            ...NOTIFICATION_JOB_OPTIONS,

            jobId:
              data.idempotencyKey,
          },
        );

      return {
        jobId:
          job.id ??
          data.idempotencyKey,

        queue:
          BULLMQ_QUEUE_NAMES.NOTIFICATIONS,

        notificationId:
          notification.notificationId,

        status:
          String(notification.status),
      };
    } catch (error: unknown) {
      /*
       * -------------------------------------------------------
       * Keep PostgreSQL state truthful if BullMQ enqueue fails
       * -------------------------------------------------------
       */
      await this.prisma.notification.update({
        where: {
          id:
            notification.id,
        },

        data: {
          status:
            'FAILED',

          failedAt:
            new Date(),

          failureReason:
            this.getErrorMessage(
              error,
            ),
        },
      });

      throw error;
    }
  }

  async getByNotificationId(
    notificationId: string,
  ): Promise<NotificationRecord | null> {
    const notification =
      await this.prisma.notification.findUnique({
        where: {
          notificationId,
        },
      });

    if (!notification) {
      return null;
    }

    return {
      id:
        notification.id,

      notificationId:
        notification.notificationId,

      userId:
        notification.userId,

      channel:
        String(notification.channel),

      status:
        String(notification.status),

      subject:
        notification.subject,

      title:
        notification.title,

      body:
        notification.body,

      template:
        notification.template,

      templateData:
        notification.templateData,

      provider:
        notification.provider,

      providerMessageId:
        notification.providerMessageId,

      idempotencyKey:
        notification.idempotencyKey,

      attempts:
        notification.attempts,

      queuedAt:
        notification.queuedAt,

      processingAt:
        notification.processingAt,

      sentAt:
        notification.sentAt,

      failedAt:
        notification.failedAt,

      failureReason:
        notification.failureReason,

      createdAt:
        notification.createdAt,

      updatedAt:
        notification.updatedAt,
    };
  }

  private toPrismaChannel(
    channel:
      NotificationJobData['channel'],
  ): 'EMAIL' | 'IN_APP' | 'PUSH' {
    switch (channel) {
      case 'email':
        return 'EMAIL';

      case 'in-app':
        return 'IN_APP';

      case 'push':
        return 'PUSH';
    }
  }

  private getErrorMessage(
    error: unknown,
  ): string {
    return error instanceof Error
      ? error.message
      : String(error);
  }
}