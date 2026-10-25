import { GurusthalamLogger } from '@gurusthalam/logger';

import type { NotificationJobData } from '../../processors/notification.processor.js';

import { NotificationFailureClassification } from './notification-provider-result.types.js';

import { NotificationIdempotencyService } from './notification-idempotency.service.js';

import type {
  NotificationDeliveryResult,
  NotificationProvider,
  NotificationSendContext,
} from './notification-provider.types.js';

export class InAppNotificationProvider implements NotificationProvider {
  readonly channel = 'in-app' as const;

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
      const messageId = `dev-in-app-${context.deliveryKey}`;

      this.logger.info(
        `DEV in-app provider deduplicated notification ${notification.notificationId}`,
        {
          operation: 'notification.provider.in_app.idempotent_hit',
          service: 'in-app',
        },
      );

      return {
        accepted: true,
        provider: 'development-in-app',
        channel: notification.channel,
        notificationId: notification.notificationId,
        messageId,
        classification: NotificationFailureClassification.SUCCESS,
      };
    }

    if (claim.status === 'in_progress') {
      this.logger.warn(
        `DEV in-app provider found an in-progress delivery for notification ${notification.notificationId}`,
        {
          operation: 'notification.provider.in_app.claim_in_progress',
          service: 'in-app',
        },
      );

      throw new Error(
        `Notification delivery is already in progress: ${context.deliveryKey}`,
      );
    }

    /*
     * This is a development provider. Reaching this point simulates
     * provider acceptance; no external in-app transport is invoked.
     *
     * Do not release the claim if acceptance finalization fails:
     * the processor must treat that outcome conservatively.
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

    const messageId = `dev-in-app-${context.deliveryKey}`;

    this.logger.info(
      `DEV in-app provider accepted notification ${notification.notificationId}`,
      {
        operation: 'notification.provider.in_app.accepted',
        service: 'in-app',
      },
    );

    return {
      accepted: true,
      provider: 'development-in-app',
      channel: notification.channel,
      notificationId: notification.notificationId,
      messageId,
      classification: NotificationFailureClassification.SUCCESS,
    };
  }
}
