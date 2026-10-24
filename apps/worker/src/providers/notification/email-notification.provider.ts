import { GurusthalamLogger } from '@gurusthalam/logger';

import type { NotificationJobData } from '../../processors/notification.processor.js';

import type {
  NotificationDeliveryResult,
  NotificationProvider,
  NotificationSendContext,
} from './notification-provider.types.js';

import { NotificationFailureClassification } from './notification-provider-result.types.js';

import { NotificationIdempotencyService } from './notification-idempotency.service.js';

export class EmailNotificationProvider implements NotificationProvider {
  readonly channel = 'email' as const;

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
      const messageId = `dev-email-${context.deliveryKey}`;

      this.logger.info(
        `DEV email provider deduplicated notification ${notification.notificationId}`,
        {
          operation: 'notification.provider.email.idempotent_hit',
          service: 'email',
        },
      );

      return {
        accepted: true,
        provider: 'development-email',
        channel: notification.channel,
        notificationId: notification.notificationId,
        messageId,
        classification: NotificationFailureClassification.SUCCESS,
      };
    }

    if (claim.status === 'in_progress') {
      this.logger.warn(
        `DEV email provider found an in-progress delivery for notification ${notification.notificationId}`,
        {
          operation: 'notification.provider.email.claim_in_progress',
          service: 'email',
        },
      );

      /*
       * Do not return accepted=true here. Another worker's claim does not
       * prove that the provider accepted the message.
       *
       * The processor should retry this transient conflict according to
       * its existing retry policy.
       */
      throw new Error(
        `Notification delivery is already in progress: ${context.deliveryKey}`,
      );
    }

    const messageId = `dev-email-${context.deliveryKey}`;

    /*
     * This provider is a development implementation: constructing the
     * result represents simulated acceptance, not transmission to a real
     * email transport.
     *
     * Once a real transport is introduced, pass the delivery key as the
     * transport's idempotency key where supported, then finalise acceptance
     * only after the transport confirms acceptance.
     */
    const finalised = await this.idempotency.markAccepted(
      context.deliveryKey,
      claim.claimToken,
    );

    if (!finalised) {
      /*
       * Ownership may have expired or changed. Do not report success.
       * Do not release the claim here: acceptance may be uncertain.
       */
      throw new Error(
        `Could not finalise notification delivery claim: ${context.deliveryKey}`,
      );
    }

    this.logger.info(
      `DEV email provider accepted notification ${notification.notificationId}`,
      {
        operation: 'notification.provider.email.accepted',
        service: 'email',
      },
    );

    return {
      accepted: true,
      provider: 'development-email',
      channel: notification.channel,
      notificationId: notification.notificationId,
      messageId,
      classification: NotificationFailureClassification.SUCCESS,
    };
  }
}
