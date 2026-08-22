import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  PrismaService,
} from '../../database/prisma/prisma.service.js';

export interface NotificationTroubleshootingResponse {
  readonly notification: {
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
  };

  readonly deliveries:
    readonly {
      readonly id:
        string;

      readonly deliveryKey:
        string;

      readonly provider:
        string;

      readonly channel:
        string;

      readonly status:
        string;

      readonly attempts:
        number;

      readonly providerMessageId:
        string | null;

      readonly lastAttemptAt:
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
    }[];
}

@Injectable()
export class NotificationTroubleshootingService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async getByNotificationId(
    notificationId:
      string,
  ): Promise<NotificationTroubleshootingResponse> {
    const notification =
      await this.prisma.notification.findUnique({
        where: {
          notificationId,
        },

        include: {
          deliveries: {
            orderBy: {
              createdAt:
                'asc',
            },
          },
        },
      });

    if (
      !notification
    ) {
      throw new NotFoundException(
        `Notification ${notificationId} was not found.`,
      );
    }

    return {
      notification: {
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
      },

      deliveries:
        notification.deliveries.map(
          (
            delivery,
          ) => ({
            id:
              delivery.id,

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
          }),
        ),
    };
  }
}