import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  PrismaService,
} from '../../database/prisma/prisma.service.js';

@Injectable()
export class NotificationOperationalService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async retry(
    notificationId: string,
  ) {
    const notification =
      await this.prisma.notification.findUnique({
        where: {
          notificationId,
        },
      });

    if (!notification) {
      throw new NotFoundException(
        `Notification ${notificationId} was not found.`,
      );
    }

    /*
     * Manual retry is deliberately restricted to terminal
     * delivery failures. A SENT notification must never be
     * silently transformed into another delivery.
     */
    if (
      notification.status !==
      'FAILED'
    ) {
      throw new BadRequestException(
        `Notification ${notificationId} cannot be retried from status ${String(notification.status)}.`,
      );
    }

    const existingOutbox =
      await this.prisma.outboxEvent.findFirst({
        where: {
          aggregateType:
            'Notification',

          aggregateId:
            notification.id,

          eventType:
            'notification.enqueue',

          OR: [
            {
              status:
                'PENDING',
            },
            {
              status:
                'PROCESSING',
            },
          ],
        },

        orderBy: {
          createdAt:
            'desc',
        },
      });

    if (existingOutbox) {
      return {
        notificationId,

        accepted:
          true,

        action:
          'retry-already-scheduled',

        outboxEventId:
          existingOutbox.id,

        status:
          String(
            existingOutbox.status,
          ),
      };
    }

    /*
     * Reconstruct the original notification job from the
     * persisted Notification record.
     *
     * This intentionally creates a NEW outbox event identity,
     * while retaining the notification's idempotencyKey.
     */
    const payload = {
      notificationId:
        notification.notificationId,

      channel:
        this.fromPrismaChannel(
          notification.channel,
        ),

      recipient: {
        userId:
          notification.userId,
      },

      subject:
        notification.subject ??
        undefined,

      title:
        notification.title ??
        undefined,

      body:
        notification.body,

      template:
        notification.template ??
        undefined,

      templateData:
        notification.templateData ??
        undefined,

      idempotencyKey:
        notification.idempotencyKey,
    };

    const dedupeKey =
      `notification-retry:${notification.notificationId}`;

    const result =
      await this.prisma.$transaction(
        async (tx) => {
          const existing =
            await tx.outboxEvent.findUnique({
              where: {
                dedupeKey,
              },
            });

          if (existing) {
            return existing;
          }

          await tx.notification.update({
            where: {
              id:
                notification.id,
            },

            data: {
              status:
                'RETRYING',

              failedAt:
                null,

              failureReason:
                null,
            },
          });

          return tx.outboxEvent.create({
            data: {
              eventType:
                'notification.enqueue',

              aggregateType:
                'Notification',

              aggregateId:
                notification.id,

              dedupeKey,

              payload,

              status:
                'PENDING',

              attempts:
                0,

              availableAt:
                new Date(),

              lastError:
                null,
            },
          });
        },
      );

    return {
      notificationId,

      accepted:
        true,

      action:
        'retry-scheduled',

      outboxEventId:
        result.id,

      status:
        String(
          result.status,
        ),
    };
  }

  private fromPrismaChannel(
    channel:
      | 'EMAIL'
      | 'IN_APP'
      | 'PUSH',
  ):
    | 'email'
    | 'in-app'
    | 'push' {
    switch (channel) {
      case 'EMAIL':
        return 'email';

      case 'IN_APP':
        return 'in-app';

      case 'PUSH':
        return 'push';
    }
  }
}