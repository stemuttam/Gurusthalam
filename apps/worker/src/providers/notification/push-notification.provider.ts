import { GurusthalamLogger } from '@gurusthalam/logger';

import type { NotificationJobData } from '../../processors/notification.processor.js';

import { NotificationFailureClassification } from './notification-provider-result.types.js';

import { NotificationIdempotencyService } from './notification-idempotency.service.js';

import type {
  NotificationDeliveryResult,
  NotificationProvider,
  NotificationSendContext,
} from './notification-provider.types.js';

export class PushNotificationProvider implements NotificationProvider {
  readonly channel = 'push' as const;

  constructor(
    private readonly logger: GurusthalamLogger,
    private readonly idempotency: NotificationIdempotencyService,
  ) {}

  async send(
    notification: NotificationJobData,
    context: NotificationSendContext,
  ): Promise<NotificationDeliveryResult> {
    const claim = await this.idempotency.claim(context.deliveryKey);

    if (claim.status === 'accepted') {
      const messageId = `dev-push-${context.deliveryKey}`;

      this.logger.info(
        `DEV push provider deduplicated notification ${notification.notificationId}`,
        {
          operation: 'notification.provider.push.idempotent_hit',
          service: 'push',
        },
      );

      return {
        accepted: true,
        provider: 'development-push',
        channel: notification.channel,
        notificationId: notification.notificationId,
        messageId,
        classification: NotificationFailureClassification.SUCCESS,
      };
    }

    if (claim.status === 'in_progress') {
      this.logger.warn(
        `DEV push provider found an in-progress delivery for notification ${notification.notificationId}`,
        {
          operation: 'notification.provider.push.claim_in_progress',
          service: 'push',
        },
      );

      throw new Error(
        `Notification delivery is already in progress: ${context.deliveryKey}`,
      );
    }

    /*
     * This is a development provider and simulates acceptance.
     * A real push transport must use the same delivery key as its
     * provider-side idempotency key when the transport supports it.
     */
    const finalised = await this.idempotency.markAccepted(
      context.deliveryKey,
      claim.claimToken,
    );

    if (!finalised) {
      throw new Error(
        `Could not finalise notification delivery claim: ${context.deliveryKey}`,
      );
    }

    const messageId = `dev-push-${context.deliveryKey}`;

    this.logger.info(
      `DEV push provider accepted notification ${notification.notificationId}`,
      {
        operation: 'notification.provider.push.accepted',
        service: 'push',
      },
    );

    return {
      accepted: true,
      provider: 'development-push',
      channel: notification.channel,
      notificationId: notification.notificationId,
      messageId,
      classification: NotificationFailureClassification.SUCCESS,
    };
  }
}
