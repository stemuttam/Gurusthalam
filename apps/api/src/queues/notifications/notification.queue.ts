import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import {
  PrismaService,
} from '../../database/prisma/prisma.service.js';

import {
  NotificationTemplateService,
} from '../templates/notification-template.service.js';

import {
  BULLMQ_QUEUE_NAMES,
} from '../bullmq/bullmq.constants.js';

import type {
  NotificationJobData,
  NotificationTemplateSnapshot,
} from './notification.types.js';

export interface NotificationRecord {
  readonly id:
    string;

  readonly notificationId:
    string;

  readonly userId:
    string;

  readonly channel:
    string;

  readonly status:
    string;

  readonly subject:
    string | null;

  readonly title:
    string | null;

  readonly body:
    string;

  readonly template:
    string | null;

  readonly templateVersion:
    number | null;

  readonly templateLocale:
    string | null;

  readonly templateSnapshot:
    unknown;

  readonly templateData:
    unknown;

  readonly provider:
    string | null;

  readonly providerMessageId:
    string | null;

  readonly idempotencyKey:
    string;

  readonly attempts:
    number;

  readonly queuedAt:
    Date;

  readonly processingAt:
    Date | null;

  readonly sentAt:
    Date | null;

  readonly failedAt:
    Date | null;

  readonly failureReason:
    string | null;

  readonly createdAt:
    Date;

  readonly updatedAt:
    Date;
}

export interface NotificationEnqueueResult {
  readonly jobId:
    string;

  readonly queue:
    string;

  readonly notificationId:
    string;

  readonly status:
    string;

  readonly outboxEventId:
    string;
}

export interface NotificationEnqueueOptions {
  readonly locale?:
    string;
}

interface ResolvedNotificationData {
  readonly data:
    NotificationJobData;

  readonly templateSnapshot?:
    NotificationTemplateSnapshot;
}

@Injectable()
export class NotificationQueueService {
  constructor(
    private readonly prisma:
      PrismaService,

    private readonly templateService:
      NotificationTemplateService,
  ) {}

  async enqueue(
    data:
      NotificationJobData,

    options:
      NotificationEnqueueOptions = {},
  ): Promise<NotificationEnqueueResult> {
    /*
     * ---------------------------------------------------------
     * Resolve published template BEFORE the transaction.
     * ---------------------------------------------------------
     *
     * This makes rendering deterministic.
     *
     * If rendering/validation fails:
     *
     * - no Notification is created
     * - no OutboxEvent is created
     * - no queue message is created
     */
    const resolved =
      await this.resolveTemplate(
        data,

        options,
      );

    const resolvedData =
      resolved.data;

    /*
     * ---------------------------------------------------------
     * Idempotency check
     * ---------------------------------------------------------
     */
    const existing =
      await this.prisma.notification.findUnique({
        where: {
          idempotencyKey:
            resolvedData.idempotencyKey,
        },
      });

    if (
      existing
    ) {
      const outbox =
        await this.prisma.outboxEvent.findUnique({
          where: {
            dedupeKey:
              `notification:${resolvedData.idempotencyKey}`,
          },
        });

      return {
        jobId:
          resolvedData.idempotencyKey,

        queue:
          BULLMQ_QUEUE_NAMES.NOTIFICATIONS,

        notificationId:
          existing.notificationId,

        status:
          String(
            existing.status,
          ),

        outboxEventId:
          outbox?.id ??
          'unknown',
      };
    }

    /*
     * ---------------------------------------------------------
     * Atomic PostgreSQL transaction
     * ---------------------------------------------------------
     */
    try {
      const result =
        await this.prisma.$transaction(
          async (
            tx,
          ) => {
            const notification =
              await tx.notification.create({
                data: {
                  notificationId:
                    resolvedData.notificationId,

                  userId:
                    resolvedData.recipient.userId,

                  channel:
                    this.toPrismaChannel(
                      resolvedData.channel,
                    ),

                  status:
                    'QUEUED',

                  subject:
                    resolvedData.subject ??
                    null,

                  title:
                    resolvedData.title ??
                    null,

                  body:
                    resolvedData.body,

                  template:
                    resolvedData.template ??
                    null,

                  ...(resolvedData.templateData !==
                  undefined
                    ? {
                        templateData:
                          JSON.parse(
                            JSON.stringify(
                              resolvedData.templateData,
                            ),
                          ),
                      }
                    : {}),

                  ...(resolvedData.templateSnapshot !==
                  undefined
                    ? {
                        templateVersion:
                          resolvedData.templateVersion ??
                          resolvedData.templateSnapshot.version,

                        templateLocale:
                          resolvedData.templateLocale ??
                          resolvedData.templateSnapshot.locale,

                        templateSnapshot:
                          JSON.parse(
                            JSON.stringify(
                              resolvedData.templateSnapshot,
                            ),
                          ),
                      }
                    : {}),

                  idempotencyKey:
                    resolvedData.idempotencyKey,

                  attempts:
                    0,

                  queuedAt:
                    new Date(),
                },
              });

            const outboxPayload =
              JSON.parse(
                JSON.stringify(
                  resolvedData,
                ),
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
                    `notification:${resolvedData.idempotencyKey}`,

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
          resolvedData.idempotencyKey,

        queue:
          BULLMQ_QUEUE_NAMES.NOTIFICATIONS,

        notificationId:
          result.notification.notificationId,

        status:
          String(
            result.notification.status,
          ),

        outboxEventId:
          result.outbox.id,
      };
    } catch (
      error: unknown
    ) {
      /*
       * ---------------------------------------------------------
       * Concurrent idempotency protection
       * ---------------------------------------------------------
       */
      const raced =
        await this.prisma.notification.findUnique({
          where: {
            idempotencyKey:
              resolvedData.idempotencyKey,
          },
        });

      if (
        raced
      ) {
        const outbox =
          await this.prisma.outboxEvent.findUnique({
            where: {
              dedupeKey:
                `notification:${resolvedData.idempotencyKey}`,
            },
          });

        return {
          jobId:
            resolvedData.idempotencyKey,

          queue:
            BULLMQ_QUEUE_NAMES.NOTIFICATIONS,

          notificationId:
            raced.notificationId,

          status:
            String(
              raced.status,
            ),

          outboxEventId:
            outbox?.id ??
            'unknown',
        };
      }

      throw error;
    }
  }

  async getByNotificationId(
    notificationId:
      string,
  ): Promise<NotificationRecord | null> {
    const notification =
      await this.prisma.notification.findUnique({
        where: {
          notificationId,
        },
      });

    if (
      !notification
    ) {
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
        String(
          notification.channel,
        ),

      status:
        String(
          notification.status,
        ),

      subject:
        notification.subject,

      title:
        notification.title,

      body:
        notification.body,

      template:
        notification.template,

      templateVersion:
        notification.templateVersion,

      templateLocale:
        notification.templateLocale,

      templateSnapshot:
        notification.templateSnapshot,

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

  private async resolveTemplate(
    data:
      NotificationJobData,

    options:
      NotificationEnqueueOptions,
  ): Promise<ResolvedNotificationData> {
    if (
      data.template ===
      undefined
    ) {
      /*
       * Existing literal-notification behavior is preserved.
       */
      return {
        data,
      };
    }

    if (
      data.templateData ===
      undefined
    ) {
      throw new BadRequestException(
        `Template-backed notification "${data.template}" requires templateData.`,
      );
    }

    const rendered =
      await this.templateService.renderPublishedVersion(
        data.template,

        data.templateData,

        options.locale,
      );

    const resolvedData:
      NotificationJobData = {
      ...data,

      ...(rendered.rendered.subject !==
      undefined
        ? {
            subject:
              rendered.rendered.subject,
          }
        : {}),

      ...(rendered.rendered.title !==
      undefined
        ? {
            title:
              rendered.rendered.title,
          }
        : {}),

      body:
        rendered.rendered.body,

      template:
        rendered.templateId,

      templateVersion:
        rendered.version,

      templateLocale:
        rendered.locale,

      templateData:
        rendered.templateData,

      templateSnapshot:
        rendered.snapshot,
    };

    return {
      data:
        resolvedData,

      templateSnapshot:
        rendered.snapshot,
    };
  }

  private toPrismaChannel(
    channel:
      NotificationJobData['channel'],
  ):
    | 'EMAIL'
    | 'IN_APP'
    | 'PUSH' {
    switch (
      channel
    ) {
      case 'email':
        return 'EMAIL';

      case 'in-app':
        return 'IN_APP';

      case 'push':
        return 'PUSH';
    }
  }
}