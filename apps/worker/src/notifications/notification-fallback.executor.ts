import { GurusthalamLogger } from '@gurusthalam/logger';

import { NotificationProviderRegistry } from '../providers/notification/notification-provider.registry.js';

import { NotificationFailureClassification } from '../providers/notification/notification-provider-result.types.js';

import { NotificationDeliveryPersistenceService } from './notification-delivery-persistence.service.js';

import { createNotificationDeliveryKey } from './notification-delivery-key.js';

import { NotificationMetricsService } from './notification-metrics.service.js';

import type {
  NotificationJobData,
  NotificationFallbackMetadata,
} from '../processors/notification.processor.js';

export interface NotificationFallbackExecutionResult {
  readonly channel: NotificationJobData['channel'];

  readonly provider: string;

  readonly messageId: string;
}

const FALLBACK_OPERATIONS = {
  STARTED: 'notification.fallback.started',

  ATTEMPT_STARTED: 'notification.fallback.attempt.started',

  ATTEMPT_FAILED: 'notification.fallback.attempt.failed',

  ATTEMPT_SUCCEEDED: 'notification.fallback.attempt.succeeded',

  EXHAUSTED: 'notification.fallback.exhausted',

  IDEMPOTENT_SKIP: 'notification.fallback.idempotent_skip',
} as const;

export class NotificationFallbackExecutor {
  constructor(
    private readonly logger: GurusthalamLogger,

    private readonly providerRegistry: NotificationProviderRegistry,

    private readonly deliveryPersistence: NotificationDeliveryPersistenceService,

    private readonly metrics: NotificationMetricsService,
  ) {}

  async execute(
    notification: NotificationJobData,

    fallbackMetadata: NotificationFallbackMetadata,

    attempt: number,
  ): Promise<NotificationFallbackExecutionResult | null> {
    this.metrics.incrementFallbackStarted();

    const nextPosition = fallbackMetadata.position + 1;

    const remainingChannels = fallbackMetadata.sequence.slice(nextPosition);

    this.logger.info(
      `Fallback lifecycle started for notification "${notification.notificationId}" using orchestration "${fallbackMetadata.orchestrationId}", plan "${fallbackMetadata.planId}" from primary channel "${fallbackMetadata.primary}" at position "${fallbackMetadata.position}".`,
      {
        operation: FALLBACK_OPERATIONS.STARTED,

        service: notification.channel,
      },
    );

    if (remainingChannels.length === 0) {
      this.metrics.incrementFallbackExhausted();

      this.logger.warn(
        `Fallback lifecycle exhausted for notification "${notification.notificationId}" using orchestration "${fallbackMetadata.orchestrationId}", plan "${fallbackMetadata.planId}".`,
        {
          operation: FALLBACK_OPERATIONS.EXHAUSTED,

          service: notification.channel,
        },
      );

      return null;
    }

    for (const [offset, channel] of remainingChannels.entries()) {
      const position = nextPosition + offset;

      this.metrics.incrementFallbackAttempts();

      this.logger.info(
        `Fallback attempt started for notification "${notification.notificationId}" using orchestration "${fallbackMetadata.orchestrationId}", plan "${fallbackMetadata.planId}", channel "${channel}", position "${position}".`,
        {
          operation: FALLBACK_OPERATIONS.ATTEMPT_STARTED,

          service: channel,
        },
      );

      const result = await this.tryChannel(
        notification,

        channel,

        attempt,

        fallbackMetadata,

        position,
      );

      if (result !== null) {
        this.metrics.incrementFallbackRecovered();

        this.logger.info(
          `Fallback attempt succeeded for notification "${notification.notificationId}" using orchestration "${fallbackMetadata.orchestrationId}", plan "${fallbackMetadata.planId}", channel "${channel}", position "${position}".`,
          {
            operation: FALLBACK_OPERATIONS.ATTEMPT_SUCCEEDED,

            service: result.provider,
          },
        );

        return result;
      }
    }

    this.metrics.incrementFallbackExhausted();

    this.logger.warn(
      `Fallback lifecycle exhausted for notification "${notification.notificationId}" using orchestration "${fallbackMetadata.orchestrationId}", plan "${fallbackMetadata.planId}" after attempting positions "${nextPosition}" through "${fallbackMetadata.sequence.length - 1}".`,
      {
        operation: FALLBACK_OPERATIONS.EXHAUSTED,

        service: notification.channel,
      },
    );

    return null;
  }

  private async tryChannel(
    notification: NotificationJobData,

    channel: NotificationJobData['channel'],

    attempt: number,

    fallbackMetadata: NotificationFallbackMetadata,

    position: number,
  ): Promise<NotificationFallbackExecutionResult | null> {
    const provider = this.providerRegistry.get(channel);

    const providerName = this.getProviderName(channel);

    const deliveryKey = createNotificationDeliveryKey(
      notification.notificationId,

      channel,

      providerName,
    );

    await this.deliveryPersistence.createIfMissing(
      notification.notificationId,

      deliveryKey,

      providerName,

      this.toPrismaChannel(channel),
    );

    const existing =
      await this.deliveryPersistence.getByDeliveryKey(deliveryKey);

    if (existing?.status === 'SENT' && existing.providerMessageId) {
      this.metrics.incrementFallbackIdempotentHits();

      this.logger.info(
        `Fallback delivery already completed for notification "${notification.notificationId}" using orchestration "${fallbackMetadata.orchestrationId}", plan "${fallbackMetadata.planId}", channel "${channel}", position "${position}".`,
        {
          operation: FALLBACK_OPERATIONS.IDEMPOTENT_SKIP,

          service: providerName,
        },
      );

      return {
        channel,

        provider: providerName,

        messageId: existing.providerMessageId,
      };
    }

    await this.deliveryPersistence.markProcessing(
      deliveryKey,

      attempt,
    );

    const fallbackNotification: NotificationJobData = {
      ...notification,

      channel,
    };

    try {
      const delivery = await provider.send(
        fallbackNotification,

        {
          deliveryKey,
        },
      );

      if (
        delivery.classification !== NotificationFailureClassification.SUCCESS ||
        delivery.accepted !== true
      ) {
        const reason =
          delivery.errorMessage ??
          `Fallback provider returned ${delivery.classification}.`;

        await this.deliveryPersistence.markFailed(
          deliveryKey,

          reason,
        );

        this.metrics.incrementFallbackAttemptFailures();

        this.logger.warn(
          `Fallback attempt failed for notification "${notification.notificationId}" using orchestration "${fallbackMetadata.orchestrationId}", plan "${fallbackMetadata.planId}", channel "${channel}", position "${position}", classification "${delivery.classification}".`,
          {
            operation: FALLBACK_OPERATIONS.ATTEMPT_FAILED,

            service: providerName,
          },
        );

        return null;
      }

      const messageId = delivery.messageId;

      if (typeof messageId !== 'string' || messageId.trim().length === 0) {
        const reason =
          'Fallback provider returned SUCCESS without a valid messageId.';

        await this.deliveryPersistence.markFailed(
          deliveryKey,

          reason,
        );

        this.metrics.incrementFallbackAttemptFailures();

        this.logger.warn(
          `Fallback attempt failed for notification "${notification.notificationId}" using orchestration "${fallbackMetadata.orchestrationId}", plan "${fallbackMetadata.planId}", channel "${channel}", position "${position}" because the provider returned no valid messageId.`,
          {
            operation: FALLBACK_OPERATIONS.ATTEMPT_FAILED,

            service: providerName,
          },
        );

        return null;
      }

      await this.deliveryPersistence.markSent(
        deliveryKey,

        messageId,
      );

      return {
        channel,

        provider: providerName,

        messageId,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      await this.deliveryPersistence.markFailed(
        deliveryKey,

        message,
      );

      this.metrics.incrementFallbackAttemptFailures();

      this.logger.warn(
        `Fallback attempt failed for notification "${notification.notificationId}" using orchestration "${fallbackMetadata.orchestrationId}", plan "${fallbackMetadata.planId}", channel "${channel}", position "${position}": ${message}`,
        {
          operation: FALLBACK_OPERATIONS.ATTEMPT_FAILED,

          service: providerName,
        },
      );

      return null;
    }
  }

  private getProviderName(channel: NotificationJobData['channel']): string {
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
    channel: NotificationJobData['channel'],
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
