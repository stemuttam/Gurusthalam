import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  randomUUID,
} from 'node:crypto';

import {
  PrismaService,
} from '../../database/prisma/prisma.service.js';

type PrismaNotificationChannel =
  | 'EMAIL'
  | 'IN_APP'
  | 'PUSH';

type WorkerNotificationChannel =
  | 'email'
  | 'in-app'
  | 'push';

/*
 * ------------------------------------------------------------
 * JSON-compatible types
 * ------------------------------------------------------------
 *
 * Prisma Json fields require values that are structurally
 * compatible with JSON input.
 */
type NotificationJsonPrimitive =
  | string
  | number
  | boolean
  | null;

type NotificationJsonValue =
  | NotificationJsonPrimitive
  | NotificationJsonValue[]
  | {
      readonly [key: string]:
        NotificationJsonValue;
    };

type NotificationJsonObject = {
  readonly [key: string]:
    NotificationJsonValue;
};

@Injectable()
export class NotificationOperationalService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  /*
   * ------------------------------------------------------------
   * MANUAL RETRY
   * ------------------------------------------------------------
   *
   * Retry:
   * - only FAILED notifications
   * - preserves original idempotencyKey
   * - preserves original delivery identity
   * - creates a new outbox event
   */
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
     * delivery failures.
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

    if (
      existingOutbox
    ) {
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
     * Reconstruct the original notification job.
     *
     * Retry intentionally keeps the original idempotencyKey.
     */
    const payload =
      this.createOriginalJobPayload(
        notification,
      );

    const dedupeKey =
      `notification-retry:${notification.notificationId}`;

    const result =
      await this.prisma.$transaction(
        async (
          tx,
        ) => {
          const existing =
            await tx.outboxEvent.findUnique({
              where: {
                dedupeKey,
              },
            });

          if (
            existing
          ) {
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

  /*
   * ------------------------------------------------------------
   * REPLAY
   * ------------------------------------------------------------
   *
   * Replay is deliberately different from retry.
   *
   * Retry:
   *   same logical notification
   *   same idempotencyKey
   *   same delivery identity
   *
   * Replay:
   *   same parent Notification
   *   NEW idempotencyKey
   *   NEW deliveryKey
   *   NEW outbox identity
   *   NEW NotificationDelivery record
   */
  async replay(
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
     * Replay is permitted only for notifications that have
     * already reached a terminal state.
     */
    if (
      notification.status !==
        'SENT' &&
      notification.status !==
        'FAILED'
    ) {
      throw new BadRequestException(
        `Notification ${notificationId} cannot be replayed from status ${String(notification.status)}.`,
      );
    }

    const replayId =
      randomUUID();

    const replayIdempotencyKey =
      `notification-replay:${notification.notificationId}:${replayId}`;

    const replayDeliveryKey =
      randomUUID();

    const replayDedupeKey =
      `notification-replay:${notification.notificationId}:${replayId}`;

    const payload =
      this.createReplayPayload(
        notification,

        replayIdempotencyKey,

        replayDeliveryKey,
      );

    const result =
      await this.prisma.outboxEvent.create({
        data: {
          eventType:
            'notification.enqueue',

          aggregateType:
            'Notification',

          aggregateId:
            notification.id,

          dedupeKey:
            replayDedupeKey,

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

    return {
      notificationId,

      replayId,

      accepted:
        true,

      action:
        'replay-scheduled',

      outboxEventId:
        result.id,

      idempotencyKey:
        replayIdempotencyKey,

      deliveryKey:
        replayDeliveryKey,

      status:
        String(
          result.status,
        ),
    };
  }

  /*
   * ------------------------------------------------------------
   * ORIGINAL RETRY PAYLOAD
   * ------------------------------------------------------------
   */
  private createOriginalJobPayload(
    notification: {
      readonly notificationId:
        string;

      readonly userId:
        string;

      readonly channel:
        PrismaNotificationChannel;

      readonly subject:
        string | null;

      readonly title:
        string | null;

      readonly body:
        string;

      readonly template:
        string | null;

      readonly templateData:
        unknown;

      readonly idempotencyKey:
        string;
    },
  ): NotificationJsonObject {
    const payload:
      Record<
        string,
        NotificationJsonValue
      > = {
      notificationId:
        notification.notificationId,

      channel:
        this.toWorkerChannel(
          notification.channel,
        ),

      recipient: {
        userId:
          notification.userId,
      },

      body:
        notification.body,

      idempotencyKey:
        notification.idempotencyKey,
    };

    if (
      notification.subject !==
      null
    ) {
      payload.subject =
        notification.subject;
    }

    if (
      notification.title !==
      null
    ) {
      payload.title =
        notification.title;
    }

    if (
      notification.template !==
      null
    ) {
      payload.template =
        notification.template;
    }

    if (
      notification.templateData !==
      null
    ) {
      payload.templateData =
        this.toJsonValue(
          notification.templateData,
        );
    }

    return payload;
  }

  /*
   * ------------------------------------------------------------
   * REPLAY PAYLOAD
   * ------------------------------------------------------------
   */
  private createReplayPayload(
    notification: {
      readonly notificationId:
        string;

      readonly userId:
        string;

      readonly channel:
        PrismaNotificationChannel;

      readonly subject:
        string | null;

      readonly title:
        string | null;

      readonly body:
        string;

      readonly template:
        string | null;

      readonly templateData:
        unknown;
    },

    replayIdempotencyKey:
      string,

    replayDeliveryKey:
      string,
  ): NotificationJsonObject {
    const payload:
      Record<
        string,
        NotificationJsonValue
      > = {
      notificationId:
        notification.notificationId,

      channel:
        this.toWorkerChannel(
          notification.channel,
        ),

      recipient: {
        userId:
          notification.userId,
      },

      body:
        notification.body,

      idempotencyKey:
        replayIdempotencyKey,

      deliveryKey:
        replayDeliveryKey,
    };

    if (
      notification.subject !==
      null
    ) {
      payload.subject =
        notification.subject;
    }

    if (
      notification.title !==
      null
    ) {
      payload.title =
        notification.title;
    }

    if (
      notification.template !==
      null
    ) {
      payload.template =
        notification.template;
    }

    if (
      notification.templateData !==
      null
    ) {
      payload.templateData =
        this.toJsonValue(
          notification.templateData,
        );
    }

    return payload;
  }

  /*
   * ------------------------------------------------------------
   * Prisma channel -> worker channel
   * ------------------------------------------------------------
   */
  private toWorkerChannel(
    channel:
      PrismaNotificationChannel,
  ):
    WorkerNotificationChannel {
    switch (
      channel
    ) {
      case 'EMAIL':
        return 'email';

      case 'IN_APP':
        return 'in-app';

      case 'PUSH':
        return 'push';

      default:
        throw new Error(
          `Unsupported notification channel: ${String(channel)}`,
        );
    }
  }

  /*
   * ------------------------------------------------------------
   * Convert Prisma Json-compatible runtime data into the
   * recursive JSON input shape expected by Prisma.
   * ------------------------------------------------------------
   */
  private toJsonValue(
    value: unknown,
  ): NotificationJsonValue {
    if (
      value ===
      null
    ) {
      return null;
    }

    if (
      typeof value ===
        'string' ||
      typeof value ===
        'number' ||
      typeof value ===
        'boolean'
    ) {
      return value;
    }

    if (
      Array.isArray(
        value,
      )
    ) {
      return value.map(
        (
          item,
        ) =>
          this.toJsonValue(
            item,
          ),
      );
    }

    if (
      typeof value ===
        'object'
    ) {
      const source =
        value as Record<
          string,
          unknown
        >;

      const result:
        Record<
          string,
          NotificationJsonValue
        > = {};

      for (
        const [
          key,
          item,
        ] of Object.entries(
          source,
        )
      ) {
        result[key] =
          this.toJsonValue(
            item,
          );
      }

      return result;
    }

    throw new TypeError(
      `Unsupported notification JSON value type: ${typeof value}`,
    );
  }
}