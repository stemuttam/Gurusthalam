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
  readonly userId: string;
  readonly email?: string;
  readonly deviceTokens?: readonly string[];
}

export interface NotificationJobData {
  readonly notificationId: string;

  readonly channel:
    NotificationChannel;

  readonly recipient:
    NotificationRecipient;

  readonly subject?: string;

  readonly title?: string;

  readonly body: string;

  readonly template?: string;

  readonly templateData?: {
    [key: string]:
      NotificationJsonValue;
  };

  readonly idempotencyKey: string;
}

export interface NotificationJobResult {
  readonly processed: true;

  readonly notificationId: string;

  readonly channel:
    NotificationChannel;

  readonly provider: string;

  readonly messageId: string;
}

class ClassifiedNotificationError extends Error {
  constructor(
    message: string,

    readonly classification:
      | 'RETRYABLE'
      | 'RATE_LIMITED'
      | 'NON_RETRYABLE'
      | 'PERMANENT',

    readonly provider: string,

    readonly errorCode?: string,
  ) {
    super(message);

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
      },
    );

    await this.persistence.markProcessing(
      notification,

      attempt,
    );

    /*
     * ---------------------------------------------------------
     * Resolve provider and canonical delivery identity once.
     * ---------------------------------------------------------
     */
    const provider =
      this.providerRegistry.get(
        notification.channel,
      );

    const providerName =
      this.getProviderName(
        notification.channel,
      );

    const deliveryKey =
      createNotificationDeliveryKey(
        notification.notificationId,

        notification.channel,

        providerName,
      );

    /*
     * ---------------------------------------------------------
     * Guarantee that the delivery record exists before any
     * provider invocation or failure handling.
     * ---------------------------------------------------------
     */
    await this.deliveryPersistence.createIfMissing(
      notification.notificationId,

      deliveryKey,

      providerName,

      this.toPrismaChannel(
        notification.channel,
      ),
    );

    try {
      /*
       * ---------------------------------------------------------
       * Check durable delivery state.
       * ---------------------------------------------------------
       */
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
          },
        );

        await this.persistence.markSent(
          notification.notificationId,

          providerName,

          deliveryRecord.providerMessageId,
        );

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

      /*
       * ---------------------------------------------------------
       * Mark provider delivery attempt as processing.
       * ---------------------------------------------------------
       */
      await this.deliveryPersistence.markProcessing(
        deliveryKey,

        attempt,
      );

      /*
       * ---------------------------------------------------------
       * Provider invocation.
       * ---------------------------------------------------------
       */
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
      } catch (error: unknown) {
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
        /*
         * -------------------------------------------------------
         * SUCCESS
         * -------------------------------------------------------
         */
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

          await this.persistence.markSent(
            notification.notificationId,

            delivery.provider,

            messageId,
          );

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

        /*
         * -------------------------------------------------------
         * RETRYABLE / RATE LIMITED
         * -------------------------------------------------------
         */
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
          );
        }

        /*
         * -------------------------------------------------------
         * NON-RETRYABLE / PERMANENT
         * -------------------------------------------------------
         */
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
          );
        }
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      /*
       * ---------------------------------------------------------
       * Classified provider failure
       * ---------------------------------------------------------
       */
      if (
        error instanceof
        ClassifiedNotificationError
      ) {
        const decision =
          decideNotificationRetry(
            error.classification,

            attempt,

            retryPolicy,
          );

        if (
          decision.shouldRetry
        ) {
          /*
           * NotificationDelivery does not have a RETRYING state.
           *
           * Therefore the delivery attempt is recorded as FAILED
           * while the parent Notification remains RETRYING.
           */
          await this.deliveryPersistence.markFailed(
            deliveryKey,

            message,
          );

          await this.persistence.markRetrying(
            notification.notificationId,

            message,

            attempt,
          );

          this.metrics.incrementRetrying();

          this.metrics.incrementProviderRetrying(
            providerName,
          );

          this.logger.error(
            `Notification retry scheduled [${error.classification}] attempt ${attempt}/${retryPolicy.maxAttempts}: ${notification.notificationId}`,
            error,
            {
              operation:
                'notification.retrying',

              service:
                providerName,
            },
          );

          throw error;
        }

        /*
         * Terminal classified failure.
         */
        await this.deliveryPersistence.markFailed(
          deliveryKey,

          message,
        );

        await this.persistence.markFailed(
          notification.notificationId,

          message,

          attempt,
        );

        this.metrics.incrementFailed();

        this.metrics.incrementProviderFailed(
          providerName,
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
              providerName,
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
            providerName,

          messageId:
            `failed-${notification.notificationId}`,
        };
      }

      /*
       * ---------------------------------------------------------
       * Unexpected provider / infrastructure exception
       * ---------------------------------------------------------
       */
      this.metrics.incrementProviderErrorsFor(
        providerName,
      );

      if (
        attempt <
        retryPolicy.maxAttempts
      ) {
        /*
         * NotificationDelivery does not have a RETRYING state.
         * Record this particular attempt as FAILED and keep the
         * parent Notification in RETRYING.
         */
        await this.deliveryPersistence.markFailed(
          deliveryKey,

          message,
        );

        await this.persistence.markRetrying(
          notification.notificationId,

          message,

          attempt,
        );

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
              providerName,
          },
        );
      } else {
        /*
         * Terminal infrastructure failure.
         */
        await this.deliveryPersistence.markFailed(
          deliveryKey,

          message,
        );

        await this.persistence.markFailed(
          notification.notificationId,

          message,

          attempt,
        );

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
      NotificationChannel,
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