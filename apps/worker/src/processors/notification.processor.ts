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

export const NOTIFICATION_CHANNELS = {
  EMAIL: 'email',
  IN_APP: 'in-app',
  PUSH: 'push',
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
      [key: string]: NotificationJsonValue;
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
    [key: string]: NotificationJsonValue;
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
  ) {}

  async process(
    job:
      Job<NotificationJobData>,
  ): Promise<NotificationJobResult> {
    const notification =
      job.data;

    const attempt =
      job.attemptsMade + 1;

    const retryPolicy =
      getNotificationRetryPolicy();

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

    /*
     * ---------------------------------------------------------
     * Notification lifecycle
     * ---------------------------------------------------------
     */
    await this.persistence.markProcessing(
      notification,
      attempt,
    );

    try {
      const provider =
        this.providerRegistry.get(
          notification.channel,
        );

      /*
       * -------------------------------------------------------
       * Resolve the stable provider identity.
       *
       * The current development providers use deterministic
       * provider names. Real providers will eventually expose
       * their own stable provider identifier.
       * -------------------------------------------------------
       */
      const providerName =
        this.getProviderName(
          notification.channel,
        );

      /*
       * -------------------------------------------------------
       * Stable delivery identity
       * -------------------------------------------------------
       *
       * This key is identical across BullMQ retries for the
       * same logical notification/provider combination.
       * -------------------------------------------------------
       */
      const deliveryKey =
        createNotificationDeliveryKey(
          notification.notificationId,

          notification.channel,

          providerName,
        );

      /*
       * -------------------------------------------------------
       * Create the delivery record if it does not already exist.
       * -------------------------------------------------------
       */
      const deliveryRecord =
        await this.deliveryPersistence.createIfMissing(
          notification.notificationId,

          deliveryKey,

          providerName,

          this.toPrismaChannel(
            notification.channel,
          ),
        );

      /*
       * -------------------------------------------------------
       * Idempotent delivery short-circuit
       * -------------------------------------------------------
       *
       * If the provider already completed this logical
       * delivery, do not send it again.
       *
       * This protects against the classic failure window:
       *
       * provider accepted
       *      ↓
       * process crashed
       *      ↓
       * BullMQ retry
       * -------------------------------------------------------
       */
      if (
        deliveryRecord.status ===
          'SENT' &&
        deliveryRecord.providerMessageId
      ) {
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
       * -------------------------------------------------------
       * Delivery lifecycle
       * -------------------------------------------------------
       */
      await this.deliveryPersistence.markProcessing(
        deliveryKey,

        attempt,
      );

      /*
       * -------------------------------------------------------
       * Provider invocation
       * -------------------------------------------------------
       */
      const delivery =
        await provider.send(
          notification,

          {
            deliveryKey,
          },
        );

      switch (
        delivery.classification
      ) {
        /*
         * -----------------------------------------------------
         * SUCCESS
         * -----------------------------------------------------
         */
        case NotificationFailureClassification.SUCCESS: {
          if (
            delivery.accepted !==
            true
          ) {
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
              .length === 0
          ) {
            throw new Error(
              `Provider "${delivery.provider}" reported SUCCESS without a valid messageId for notification "${notification.notificationId}".`,
            );
          }

          /*
           * Persist delivery success first.
           *
           * If the worker crashes after this operation but
           * before Notification.markSent(), the next retry
           * will see delivery.status = SENT and short-circuit.
           */
          await this.deliveryPersistence.markSent(
            deliveryKey,

            messageId,
          );

          await this.persistence.markSent(
            notification.notificationId,

            delivery.provider,

            messageId,
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
         * -----------------------------------------------------
         * RETRYABLE / RATE LIMITED
         * -----------------------------------------------------
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
         * -----------------------------------------------------
         * NON-RETRYABLE / PERMANENT
         * -----------------------------------------------------
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
       * -------------------------------------------------------
       * Classified provider failure
       * -------------------------------------------------------
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

        /*
         * -----------------------------------------------------
         * Retryable provider failure
         * -----------------------------------------------------
         */
        if (
          decision.shouldRetry
        ) {
          /*
           * Obtain the same stable delivery key so that the
           * delivery record is updated rather than duplicated.
           */
          const providerName =
            error.provider;

          const deliveryKey =
            createNotificationDeliveryKey(
              notification.notificationId,

              notification.channel,

              providerName,
            );

          await this.deliveryPersistence.markFailed(
            deliveryKey,

            message,
          );

          await this.persistence.markRetrying(
            notification.notificationId,

            message,

            attempt,
          );

          this.logger.error(
            `Notification retry scheduled [${error.classification}] attempt ${attempt}/${retryPolicy.maxAttempts}: ${notification.notificationId}`,
            error,
            {
              operation:
                'notification.retrying',

              service:
                error.provider,
            },
          );

          throw error;
        }

        /*
         * -----------------------------------------------------
         * Terminal provider failure
         * -----------------------------------------------------
         */
        const providerName =
          error.provider;

        const deliveryKey =
          createNotificationDeliveryKey(
            notification.notificationId,

            notification.channel,

            providerName,
          );

        await this.deliveryPersistence.markFailed(
          deliveryKey,

          message,
        );

        await this.persistence.markFailed(
          notification.notificationId,

          message,

          attempt,
        );

        this.logger.error(
          `Notification terminal failure [${error.classification}] attempt ${attempt}/${retryPolicy.maxAttempts}: ${notification.notificationId}`,
          error,
          {
            operation:
              'notification.failed',

            service:
              error.provider,
          },
        );

        /*
         * Terminal business failure is already persisted as
         * FAILED, so BullMQ must not execute infrastructure
         * retries for this result.
         */
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

      /*
       * -------------------------------------------------------
       * Unexpected infrastructure/provider exception
       * -------------------------------------------------------
       *
       * Treat unexpected exceptions as retryable infrastructure
       * failures.
       * -------------------------------------------------------
       */
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

      if (
        attempt <
        retryPolicy.maxAttempts
      ) {
        await this.deliveryPersistence.markFailed(
          deliveryKey,

          message,
        );

        await this.persistence.markRetrying(
          notification.notificationId,

          message,

          attempt,
        );

        this.logger.error(
          `Notification infrastructure retry scheduled attempt ${attempt}/${retryPolicy.maxAttempts}: ${notification.notificationId}`,
          error,
          {
            operation:
              'notification.retrying',

            service:
              notification.channel,
          },
        );
      } else {
        await this.deliveryPersistence.markFailed(
          deliveryKey,

          message,
        );

        await this.persistence.markFailed(
          notification.notificationId,

          message,

          attempt,
        );

        this.logger.error(
          `Notification infrastructure retry limit reached: ${notification.notificationId}`,
          error,
          {
            operation:
              'notification.failed',

            service:
              notification.channel,
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
    switch (channel) {
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