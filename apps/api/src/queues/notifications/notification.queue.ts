import {
  Injectable,
} from '@nestjs/common';

import {
  PrismaService,
} from '../../database/prisma/prisma.service.js';

import {
  BULLMQ_QUEUE_NAMES,
} from '../bullmq/bullmq.constants.js';

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
  readonly outboxEventId: string;
}

@Injectable()
export class NotificationQueueService {
  constructor(
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
      const outbox =
        await this.prisma.outboxEvent.findUnique({
          where: {
            dedupeKey:
              `notification:${data.idempotencyKey}`,
          },
        });

      return {
        jobId:
          data.idempotencyKey,

        queue:
          BULLMQ_QUEUE_NAMES.NOTIFICATIONS,

        notificationId:
          existing.notificationId,

        status:
          String(existing.status),

        outboxEventId:
          outbox?.id ?? 'unknown',
      };
    }

    /*
     * ---------------------------------------------------------
     * Atomic PostgreSQL transaction
     * ---------------------------------------------------------
     *
     * Notification and OutboxEvent are committed together.
     * No BullMQ call happens inside this transaction.
     */
    try {
      const result =
        await this.prisma.$transaction(
          async (tx) => {
            const notification =
              await tx.notification.create({
                data: {
                  notificationId:
                    data.notificationId,

                  userId:
                    data.recipient.userId,

                  channel:
                    this.toPrismaChannel(
                      data.channel,
                    ),

                  status:
                    'QUEUED',

                  subject:
                    data.subject ?? null,

                  title:
                    data.title ?? null,

                  body:
                    data.body,

                  template:
                    data.template ?? null,

                  /*
                   * JSON.parse returns `any`, which is exactly
                   * what Prisma's JSON input accepts at this
                   * serialization boundary.
                   *
                   * We intentionally persist a JSON snapshot
                   * rather than a live TypeScript object.
                   */
                  ...(data.templateData !==
                  undefined
                    ? {
                        templateData:
                          JSON.parse(
                            JSON.stringify(
                              data.templateData,
                            ),
                          ),
                      }
                    : {}),

                  idempotencyKey:
                    data.idempotencyKey,

                  attempts:
                    0,

                  queuedAt:
                    new Date(),
                },
              });

            const outboxPayload =
              JSON.parse(
                JSON.stringify(data),
              );

            const outbox =
              await tx.outboxEvent.create({
                data: {
                  eventType:
                    'notification.enqueue',

                  aggregateType:
                    'Notification',

                  aggregateId:
                    notification.id,

                  dedupeKey:
                    `notification:${data.idempotencyKey}`,

                  payload:
                    outboxPayload,

                  status:
                    'PENDING',

                  attempts:
                    0,

                  availableAt:
                    new Date(),
                },
              });

            return {
              notification,
              outbox,
            };
          },
        );

      return {
        jobId:
          data.idempotencyKey,

        queue:
          BULLMQ_QUEUE_NAMES.NOTIFICATIONS,

        notificationId:
          result.notification
            .notificationId,

        status:
          String(
            result.notification.status,
          ),

        outboxEventId:
          result.outbox.id,
      };
    } catch (error: unknown) {
      /*
       * ---------------------------------------------------------
       * Concurrent idempotency protection
       * ---------------------------------------------------------
       */
      const raced =
        await this.prisma.notification.findUnique({
          where: {
            idempotencyKey:
              data.idempotencyKey,
          },
        });

      if (raced) {
        const outbox =
          await this.prisma.outboxEvent.findUnique({
            where: {
              dedupeKey:
                `notification:${data.idempotencyKey}`,
            },
          });

        return {
          jobId:
            data.idempotencyKey,

          queue:
            BULLMQ_QUEUE_NAMES.NOTIFICATIONS,

          notificationId:
            raced.notificationId,

          status:
            String(raced.status),

          outboxEventId:
            outbox?.id ?? 'unknown',
        };
      }

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
}