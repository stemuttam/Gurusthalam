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
  NotificationDeliveryPersistenceService,
} from './notification-delivery-persistence.service.js';

import {
  createNotificationDeliveryKey,
} from './notification-delivery-key.js';

import type {
  NotificationJobData,
  NotificationFallbackMetadata,
} from '../processors/notification.processor.js';

export interface NotificationFallbackExecutionResult {
  readonly channel:
    NotificationJobData['channel'];

  readonly provider:
    string;

  readonly messageId:
    string;
}

export class NotificationFallbackExecutor {
  constructor(
    private readonly logger:
      GurusthalamLogger,

    private readonly providerRegistry:
      NotificationProviderRegistry,

    private readonly deliveryPersistence:
      NotificationDeliveryPersistenceService,
  ) {}

  async execute(
    notification:
      NotificationJobData,

    fallbackMetadata:
      NotificationFallbackMetadata,

    attempt:
      number,
  ):
    Promise<
      NotificationFallbackExecutionResult | null
    > {
    const nextPosition =
      fallbackMetadata.position +
      1;

    const remainingChannels =
      fallbackMetadata.sequence.slice(
        nextPosition,
      );

    if (
      remainingChannels.length ===
      0
    ) {
      return null;
    }

    for (
      const channel of
        remainingChannels
    ) {
      const result =
        await this.tryChannel(
          notification,

          channel,

          attempt,
        );

      if (
        result !==
        null
      ) {
        return result;
      }
    }

    return null;
  }

  private async tryChannel(
    notification:
      NotificationJobData,

    channel:
      NotificationJobData['channel'],

    attempt:
      number,
  ):
    Promise<
      NotificationFallbackExecutionResult | null
    > {
    const provider =
      this.providerRegistry.get(
        channel,
      );

    const providerName =
      this.getProviderName(
        channel,
      );

    const deliveryKey =
      createNotificationDeliveryKey(
        notification.notificationId,

        channel,

        providerName,
      );

    await this.deliveryPersistence.createIfMissing(
      notification.notificationId,

      deliveryKey,

      providerName,

      this.toPrismaChannel(
        channel,
      ),
    );

    const existing =
      await this.deliveryPersistence.getByDeliveryKey(
        deliveryKey,
      );

    if (
      existing?.status ===
        'SENT' &&
      existing.providerMessageId
    ) {
      this.logger.info(
        `Fallback delivery already completed: ${notification.notificationId}`,
        {
          operation:
            'notification.fallback.idempotent_skip',

          service:
            providerName,
        },
      );

      return {
        channel,

        provider:
          providerName,

        messageId:
          existing.providerMessageId,
      };
    }

    await this.deliveryPersistence.markProcessing(
      deliveryKey,

      attempt,
    );

    const fallbackNotification:
      NotificationJobData = {
      ...notification,

      channel,
    };

    try {
      const delivery =
        await provider.send(
          fallbackNotification,

          {
            deliveryKey,
          },
        );

      if (
        delivery.classification !==
        NotificationFailureClassification.SUCCESS ||
        delivery.accepted !==
          true
      ) {
        const reason =
          delivery.errorMessage ??
          `Fallback provider returned ${delivery.classification}.`;

        await this.deliveryPersistence.markFailed(
          deliveryKey,

          reason,
        );

        this.logger.warn(
          `Notification fallback channel "${channel}" failed: ${notification.notificationId}`,
          {
            operation:
              'notification.fallback.failed',

            service:
              providerName,
          },
        );

        return null;
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
        await this.deliveryPersistence.markFailed(
          deliveryKey,

          'Fallback provider returned SUCCESS without a valid messageId.',
        );

        this.logger.warn(
          `Notification fallback channel "${channel}" returned SUCCESS without a messageId: ${notification.notificationId}`,
          {
            operation:
              'notification.fallback.failed',

            service:
              providerName,
          },
        );

        return null;
      }

      await this.deliveryPersistence.markSent(
        deliveryKey,

        messageId,
      );

      this.logger.info(
        `Notification fallback delivered through "${channel}": ${notification.notificationId}`,
        {
          operation:
            'notification.fallback.delivered',

          service:
            providerName,
        },
      );

      return {
        channel,

        provider:
          providerName,

        messageId,
      };
    } catch (
      error: unknown
    ) {
      const message =
        error instanceof Error
          ? error.message
          : String(
              error,
            );

      await this.deliveryPersistence.markFailed(
        deliveryKey,

        message,
      );

      this.logger.warn(
        `Notification fallback transport failed through "${channel}": ${notification.notificationId}`,
        {
          operation:
            'notification.fallback.failed',

          service:
            providerName,
        },
      );

      return null;
    }
  }

  private getProviderName(
    channel:
      NotificationJobData['channel'],
  ):
    string {
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