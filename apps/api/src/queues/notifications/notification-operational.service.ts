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
   * - preserves the original idempotencyKey
   * - preserves the original logical notification
   * - creates a NEW retry outbox identity for every legitimate
   *   manual retry lifecycle
   *
   * Concurrency invariant:
   *
   *   FAILED
   *      |
   *      +---- request A ----+
   *      |                   |
   *      +---- request B ----+
   *                          |
   *              exactly one FAILED -> RETRYING
   *                          |
   *                 exactly one outbox
   *
   * A later FAILED state is allowed to create another retry
   * because every manual retry receives a fresh UUID-backed
   * dedupeKey.
   */
  async retry(
    notificationId:
      string,
  ) {
    const notification =
      await this.prisma.notification.findUnique({
        where: {
          notificationId,
        },
      });

    if (
      !notification
    ) {
      throw new NotFoundException(
        `Notification ${notificationId} was not found.`,
      );
    }

    /*
     * Manual retry is only valid for a terminal delivery failure.
     */
    if (
      notification.status !==
      'FAILED'
    ) {
      /*
       * RETRYING is normally handled below by the transaction
       * race-safe path only when the request began from FAILED.
       *
       * A direct retry request against a currently RETRYING
       * notification is rejected unless it is already represented
       * by an active retry operation.
       */
      if (
        notification.status ===
        'RETRYING'
      ) {
        const existingActiveRetry =
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
          existingActiveRetry
        ) {
          return {
            notificationId,

            accepted:
              true,

            action:
              'retry-already-scheduled',

            outboxEventId:
              existingActiveRetry.id,

            status:
              String(
                existingActiveRetry.status,
              ),
          };
        }

        throw new BadRequestException(
          `Notification ${notificationId} is marked RETRYING but has no pending retry operation.`,
        );
      }

      throw new BadRequestException(
        `Notification ${notificationId} cannot be retried from status ${String(notification.status)}.`,
      );
    }

    /*
     * Reconstruct the original notification job.
     *
     * Retry intentionally preserves the original logical
     * idempotencyKey.
     */
    const payload =
      this.createOriginalJobPayload(
        notification,
      );

    /*
     * IMPORTANT:
     *
     * This key is intentionally unique per manual retry
     * lifecycle.
     *
     * We must not use:
     *
     *   notification-retry:<notificationId>
     *
     * because that would permanently block a legitimate second
     * manual retry after the notification fails again later.
     */
    const retryId =
      randomUUID();

    const dedupeKey =
      `notification-retry:${notification.notificationId}:${retryId}`;

    const result =
      await this.prisma.$transaction(
        async (
          tx,
        ) => {
          /*
           * Critical race-safety boundary.
           *
           * Only one concurrent transaction can change this
           * specific Notification from FAILED -> RETRYING.
           *
           * PostgreSQL serializes competing UPDATE statements
           * against the same row. The second transaction therefore
           * receives count = 0 after the first transaction commits.
           */
          const transition =
            await tx.notification.updateMany({
              where: {
                id:
                  notification.id,

                status:
                  'FAILED',
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

          if (
            transition.count ===
            1
          ) {
            /*
             * We won the state transition and therefore own
             * creation of the retry outbox event.
             */
            const created =
              await tx.outboxEvent.create({
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

            return {
              kind:
                'created' as const,

              outboxEvent:
                created,
            };
          }

          /*
           * Another concurrent request won the FAILED ->
           * RETRYING transition.
           *
           * Its outbox event must already exist once the competing
           * transaction is visible to us.
           */
          const existingRetry =
            await tx.outboxEvent.findFirst({
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
            existingRetry
          ) {
            return {
              kind:
                'existing' as const,

              outboxEvent:
                existingRetry,
            };
          }

          /*
           * This should only be reachable if the database state is
           * inconsistent. We fail loudly rather than silently
           * creating a second retry.
           */
          throw new BadRequestException(
            `Notification ${notificationId} is no longer retryable because another retry operation is already in progress.`,
          );
        },
      );

    if (
      result.kind ===
      'existing'
    ) {
      return {
        notificationId,

        accepted:
          true,

        action:
          'retry-already-scheduled',

        outboxEventId:
          result.outboxEvent.id,

        status:
          String(
            result.outboxEvent.status,
          ),
      };
    }

    return {
      notificationId,

      accepted:
        true,

      action:
        'retry-scheduled',

      outboxEventId:
        result.outboxEvent.id,

      status:
        String(
          result.outboxEvent.status,
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
    notificationId:
      string,
  ) {
    const notification =
      await this.prisma.notification.findUnique({
        where: {
          notificationId,
        },
      });

    if (
      !notification
    ) {
      throw new NotFoundException(
        `Notification ${notificationId} was not found.`,
      );
    }

    /*
     * Replay is permitted only for terminal states.
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
   * Convert runtime values into Prisma-compatible JSON.
   * ------------------------------------------------------------
   */
  private toJsonValue(
    value:
      unknown,
  ):
    NotificationJsonValue {
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