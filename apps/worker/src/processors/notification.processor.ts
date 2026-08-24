import type {
  Job,
} from 'bullmq';

import {
  GurusthalamLogger,
} from '@gurusthalam/logger';

import {
  NotificationProviderRegistry,
} from '../providers/notification/notification-provider.registry.js';

import {
  NotificationFailureClassification,
} from '../providers/notification/notification-provider-result.types.js';

import {
  NotificationPersistenceService,
} from '../notifications/notification-persistence.service.js';

import {
  NotificationDeliveryPersistenceService,
} from '../notifications/notification-delivery-persistence.service.js';

import {
  createNotificationDeliveryKey,
} from '../notifications/notification-delivery-key.js';

import {
  decideNotificationRetry,
  getNotificationRetryPolicy,
} from '../notifications/notification-retry.policy.js';

import {
  NotificationMetricsService,
} from '../notifications/notification-metrics.service.js';

export const NOTIFICATION_CHANNELS = {
  EMAIL:
    'email',

  IN_APP:
    'in-app',

  PUSH:
    'push',
} as const;

export type NotificationChannel =
  (typeof NOTIFICATION_CHANNELS)[keyof typeof NOTIFICATION_CHANNELS];

export type NotificationJsonPrimitive =
  | string
  | number
  | boolean
  | null;

export type NotificationJsonValue =
  | NotificationJsonPrimitive
  | NotificationJsonValue[]
  | {
      [key: string]:
        NotificationJsonValue;
    };

export interface NotificationRecipient {
  readonly userId:
    string;

  readonly email?:
    string;

  readonly deviceTokens?:
    readonly string[];
}

export interface NotificationJobData {
  readonly notificationId:
    string;

  readonly channel:
    NotificationChannel;

  readonly recipient:
    NotificationRecipient;

  readonly subject?:
    string;

  readonly title?:
    string;

  readonly body:
    string;

  readonly template?:
    string;

  readonly templateData?: {
    [key: string]:
      NotificationJsonValue;
  };

  readonly idempotencyKey:
    string;

  /**
   * Normal notification jobs omit this field and the processor
   * derives the canonical delivery key.
   *
   * Replay jobs provide a new delivery key so they create a
   * distinct NotificationDelivery record.
   */
  readonly deliveryKey?:
    string;
}

export interface NotificationJobResult {
  readonly processed:
    true;

  readonly notificationId:
    string;

  readonly channel:
    NotificationChannel;

  readonly provider:
    string;

  readonly messageId:
    string;
}

class ClassifiedNotificationError
  extends Error {
  constructor(
    message:
      string,

    readonly classification:
      | 'RETRYABLE'
      | 'RATE_LIMITED'
      | 'NON_RETRYABLE'
      | 'PERMANENT',

    readonly provider:
      string,

    readonly errorCode?:
      string,

    readonly retryAfterMs?:
      number,
  ) {
    super(
      message,
    );

    this.name =
      'ClassifiedNotificationError';
  }
}

export class NotificationProcessor {
  constructor(
    private readonly logger:
      GurusthalamLogger,

    private readonly providerRegistry:
      NotificationProviderRegistry,

    private readonly persistence:
      NotificationPersistenceService,

    private readonly deliveryPersistence:
      NotificationDeliveryPersistenceService,

    private readonly metrics:
      NotificationMetricsService,
  ) {}

  async process(
    job:
      Job<NotificationJobData>,
  ): Promise<NotificationJobResult> {
    const startedAt =
      Date.now();

    const notification =
      job.data;

    const isReplay =
      notification.deliveryKey !==
      undefined;

    const attempt =
      job.attemptsMade + 1;

    const retryPolicy =
      getNotificationRetryPolicy();

    this.metrics.incrementProcessing();

    this.logger.info(
      `Processing notification job: ${
        job.id ??
        'unknown'
      }`,
      {
        operation:
          'notification.process',

        service:
          notification.channel,

        ...(isReplay
          ? {
              deliveryKey:
                notification.deliveryKey,
            }
          : {}),
      },
    );

    if (
      !isReplay
    ) {
      await this.persistence.markProcessing(
        notification,

        attempt,
      );
    }

    const provider =
      this.providerRegistry.get(
        notification.channel,
      );

    const providerName =
      this.getProviderName(
        notification.channel,
      );

    const deliveryKey =
      notification.deliveryKey ??
      createNotificationDeliveryKey(
        notification.notificationId,

        notification.channel,

        providerName,
      );

    await this.deliveryPersistence.createIfMissing(
      notification.notificationId,

      deliveryKey,

      providerName,

      this.toPrismaChannel(
        notification.channel,
      ),
    );

    try {
      const deliveryRecord =
        await this.deliveryPersistence.getByDeliveryKey(
          deliveryKey,
        );

      if (
        deliveryRecord?.status ===
          'SENT' &&
        deliveryRecord.providerMessageId
      ) {
        this.metrics.incrementIdempotentHits();

        this.metrics.incrementProviderIdempotentHits(
          providerName,
        );

        const latency =
          Date.now() -
          startedAt;

        this.metrics.recordLatency(
          latency,
        );

        this.metrics.recordProviderLatency(
          providerName,

          latency,
        );

        this.logger.info(
          `Notification delivery already completed: ${notification.notificationId}`,
          {
            operation:
              'notification.delivery.idempotent_skip',

            service:
              providerName,

            ...(isReplay
              ? {
                  deliveryKey,
                }
              : {}),
          },
        );

        if (
          !isReplay
        ) {
          await this.persistence.markSent(
            notification.notificationId,

            providerName,

            deliveryRecord.providerMessageId,
          );
        }

        return {
          processed:
            true,

          notificationId:
            notification.notificationId,

          channel:
            notification.channel,

          provider:
            providerName,

          messageId:
            deliveryRecord.providerMessageId,
        };
      }

      await this.deliveryPersistence.markProcessing(
        deliveryKey,

        attempt,
      );

      const providerStartedAt =
        Date.now();

      let delivery;

      try {
        delivery =
          await provider.send(
            notification,

            {
              deliveryKey,
            },
          );
      } catch (
        error: unknown
      ) {
        this.metrics.incrementProviderErrorsFor(
          providerName,
        );

        this.metrics.recordProviderLatency(
          providerName,

          Date.now() -
            providerStartedAt,
        );

        throw error;
      }

      const providerLatency =
        Date.now() -
        providerStartedAt;

      this.metrics.recordProviderLatency(
        providerName,

        providerLatency,
      );

      switch (
        delivery.classification
      ) {
        case NotificationFailureClassification.SUCCESS: {
          if (
            delivery.accepted !==
            true
          ) {
            this.metrics.incrementProviderErrorsFor(
              providerName,
            );

            throw new Error(
              `Provider "${delivery.provider}" reported SUCCESS without accepting notification "${notification.notificationId}".`,
            );
          }

          const messageId =
            delivery.messageId;

          if (
            typeof messageId !==
              'string' ||
            messageId.trim()
              .length ===
              0
          ) {
            this.metrics.incrementProviderErrorsFor(
              providerName,
            );

            throw new Error(
              `Provider "${delivery.provider}" reported SUCCESS without a valid messageId for notification "${notification.notificationId}".`,
            );
          }

          await this.deliveryPersistence.markSent(
            deliveryKey,

            messageId,
          );

          if (
            !isReplay
          ) {
            await this.persistence.markSent(
              notification.notificationId,

              delivery.provider,

              messageId,
            );
          }

          this.metrics.incrementSent();

          this.metrics.incrementProviderSent(
            providerName,
          );

          this.metrics.recordLatency(
            Date.now() -
              startedAt,
          );

          this.logger.info(
            `Notification delivered: ${notification.notificationId}`,
            {
              operation:
                'notification.delivered',

              service:
                delivery.provider,

              ...(isReplay
                ? {
                    deliveryKey,
                  }
                : {}),
            },
          );

          return {
            processed:
              true,

            notificationId:
              notification.notificationId,

            channel:
              notification.channel,

            provider:
              delivery.provider,

            messageId,
          };
        }

        case NotificationFailureClassification.RETRYABLE:
        case NotificationFailureClassification.RATE_LIMITED: {
          const reason =
            delivery.errorMessage ??
            `Notification provider returned ${delivery.classification}.`;

          throw new ClassifiedNotificationError(
            reason,

            delivery.classification,

            delivery.provider,

            delivery.errorCode,

            delivery.retryAfterMs,
          );
        }

        case NotificationFailureClassification.NON_RETRYABLE:
        case NotificationFailureClassification.PERMANENT: {
          const reason =
            delivery.errorMessage ??
            `Notification provider returned ${delivery.classification}.`;

          throw new ClassifiedNotificationError(
            reason,

            delivery.classification,

            delivery.provider,

            delivery.errorCode,

            delivery.retryAfterMs,
          );
        }
      }
    } catch (
      error: unknown
    ) {
      const message =
        error instanceof Error
          ? error.message
          : String(
              error,
            );

      if (
        error instanceof
        ClassifiedNotificationError
      ) {
        const decision =
          decideNotificationRetry(
            error.classification,

            attempt,

            retryPolicy,

            error.retryAfterMs,
          );

        if (
          decision.shouldRetry
        ) {
          await this.deliveryPersistence.markFailed(
            deliveryKey,

            message,
          );

          if (
            !isReplay
          ) {
            await this.persistence.markRetrying(
              notification.notificationId,

              message,

              attempt,
            );
          }

          this.metrics.incrementRetrying();

          this.metrics.incrementProviderRetrying(
            error.provider,
          );

          this.logger.warn(
            `Notification retry scheduled [${error.classification}] attempt ${attempt}/${retryPolicy.maxAttempts} delay=${decision.delayMs}ms: ${notification.notificationId}`,
            {
              operation:
                'notification.retrying',

              service:
                error.provider,

              ...(isReplay
                ? {
                    deliveryKey,
                  }
                : {}),
            },
          );

          /*
           * BullMQ receives this Error and invokes the custom
           * backoff strategy from queue.policy.ts. For a
           * RATE_LIMITED error the strategy reads retryAfterMs.
           */
          throw error;
        }

        await this.deliveryPersistence.markFailed(
          deliveryKey,

          message,
        );

        if (
          !isReplay
        ) {
          await this.persistence.markFailed(
            notification.notificationId,

            message,

            attempt,
          );
        }

        this.metrics.incrementFailed();

        this.metrics.incrementProviderFailed(
          error.provider,
        );

        this.metrics.recordLatency(
          Date.now() -
            startedAt,
        );

        this.logger.error(
          `Notification terminal failure [${error.classification}] attempt ${attempt}/${retryPolicy.maxAttempts}: ${notification.notificationId}`,
          error,
          {
            operation:
              'notification.failed',

            service:
              error.provider,

            ...(isReplay
              ? {
                  deliveryKey,
                }
              : {}),
          },
        );

        return {
          processed:
            true,

          notificationId:
            notification.notificationId,

          channel:
            notification.channel,

          provider:
            error.provider,

          messageId:
            `failed-${notification.notificationId}`,
        };
      }

      this.metrics.incrementProviderErrorsFor(
        providerName,
      );

      const decision =
        decideNotificationRetry(
          NotificationFailureClassification.RETRYABLE,

          attempt,

          retryPolicy,
        );

      if (
        decision.shouldRetry
      ) {
        await this.deliveryPersistence.markFailed(
          deliveryKey,

          message,
        );

        if (
          !isReplay
        ) {
          await this.persistence.markRetrying(
            notification.notificationId,

            message,

            attempt,
          );
        }

        this.metrics.incrementRetrying();

        this.metrics.incrementProviderRetrying(
          providerName,
        );

        this.logger.error(
          `Notification infrastructure retry scheduled attempt ${attempt}/${retryPolicy.maxAttempts}: ${notification.notificationId}`,
          error,
          {
            operation:
              'notification.retrying',

            service:
              notification.channel,

            ...(isReplay
              ? {
                  deliveryKey,
                }
              : {}),
          },
        );
      } else {
        await this.deliveryPersistence.markFailed(
          deliveryKey,

          message,
        );

        if (
          !isReplay
        ) {
          await this.persistence.markFailed(
            notification.notificationId,

            message,

            attempt,
          );
        }

        this.metrics.incrementFailed();

        this.metrics.incrementProviderFailed(
          providerName,
        );

        this.metrics.recordLatency(
          Date.now() -
            startedAt,
        );

        this.logger.error(
          `Notification infrastructure retry limit reached: ${notification.notificationId}`,
          error,
          {
            operation:
              'notification.failed',

            service:
              providerName,

            ...(isReplay
              ? {
                  deliveryKey,
                }
              : {}),
          },
        );
      }

      throw error;
    }
  }

  private getProviderName(
    channel:
      NotificationChannel,
  ): string {
    switch (
      channel
    ) {
      case 'email':
        return 'development-email';

      case 'in-app':
        return 'development-in-app';

      case 'push':
        return 'development-push';
    }
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