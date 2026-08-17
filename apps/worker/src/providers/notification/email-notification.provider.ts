import {
  GurusthalamLogger,
} from '@gurusthalam/logger';

import type {
  NotificationJobData,
} from '../../processors/notification.processor.js';

import type {
  NotificationDeliveryResult,
  NotificationProvider,
  NotificationSendContext,
} from './notification-provider.types.js';

import {
  NotificationFailureClassification,
} from './notification-provider-result.types.js';

import {
  NotificationIdempotencyService,
} from './notification-idempotency.service.js';

export class EmailNotificationProvider
  implements NotificationProvider
{
  readonly channel =
    'email' as const;

  constructor(
    private readonly logger:
      GurusthalamLogger,

    private readonly idempotency:
      NotificationIdempotencyService,
  ) {}

  async send(
    notification:
      NotificationJobData,

    context:
      NotificationSendContext,
  ): Promise<NotificationDeliveryResult> {
    /*
     * ---------------------------------------------------------
     * Durable provider-level idempotency
     * ---------------------------------------------------------
     *
     * The delivery key is stored in Redis so the idempotency
     * decision survives worker-process restarts.
     */
    const alreadyAccepted =
      await this.idempotency.isAccepted(
        context.deliveryKey,
      );

    if (
      alreadyAccepted
    ) {
      const messageId =
        `dev-email-${context.deliveryKey}`;

      this.logger.info(
        `DEV email provider deduplicated notification ${notification.notificationId}`,
        {
          operation:
            'notification.provider.email.idempotent_hit',

          service:
            'email',
        },
      );

      return {
        accepted:
          true,

        provider:
          'development-email',

        channel:
          notification.channel,

        notificationId:
          notification.notificationId,

        messageId,

        classification:
          NotificationFailureClassification.SUCCESS,
      };
    }

    /*
     * ---------------------------------------------------------
     * Atomically claim the delivery key
     * ---------------------------------------------------------
     *
     * SET NX guarantees that only one concurrent worker/process
     * can claim a new logical delivery.
     */
    const claimed =
      await this.idempotency.markAccepted(
        context.deliveryKey,
      );

    if (
      !claimed
    ) {
      const messageId =
        `dev-email-${context.deliveryKey}`;

      this.logger.info(
        `DEV email provider detected concurrent duplicate notification ${notification.notificationId}`,
        {
          operation:
            'notification.provider.email.idempotent_race',

          service:
            'email',
        },
      );

      return {
        accepted:
          true,

        provider:
          'development-email',

        channel:
          notification.channel,

        notificationId:
          notification.notificationId,

        messageId,

        classification:
          NotificationFailureClassification.SUCCESS,
      };
    }

    /*
     * ---------------------------------------------------------
     * Development provider acceptance
     * ---------------------------------------------------------
     */
    const messageId =
      `dev-email-${context.deliveryKey}`;

    this.logger.info(
      `DEV email provider accepted notification ${notification.notificationId}`,
      {
        operation:
          'notification.provider.email.accepted',

        service:
          'email',
      },
    );

    return {
      accepted:
        true,

      provider:
        'development-email',

      channel:
        notification.channel,

      notificationId:
        notification.notificationId,

      messageId,

      classification:
        NotificationFailureClassification.SUCCESS,
    };
  }
}