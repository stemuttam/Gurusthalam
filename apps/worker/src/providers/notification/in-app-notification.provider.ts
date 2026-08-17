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

export class InAppNotificationProvider
  implements NotificationProvider
{
  readonly channel =
    'in-app' as const;

  constructor(
    private readonly logger:
      GurusthalamLogger,
  ) {}

  async send(
    notification:
      NotificationJobData,

    context:
      NotificationSendContext,
  ): Promise<NotificationDeliveryResult> {
    /*
     * The development in-app provider does not currently
     * need the delivery key for transport purposes, but we
     * intentionally consume the provider context so the
     * implementation remains compatible with the common
     * provider contract.
     */
    void context;

    const messageId =
      `dev-in-app-${notification.notificationId}`;

    this.logger.info(
      `DEV in-app provider accepted notification ${notification.notificationId}`,
      {
        operation:
          'notification.provider.in_app.accepted',

        service:
          'in-app',
      },
    );

    return {
      accepted:
        true,

      provider:
        'development-in-app',

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