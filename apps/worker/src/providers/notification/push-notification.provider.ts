import {
  GurusthalamLogger,
} from '@gurusthalam/logger';

import type {
  NotificationJobData,
} from '../../processors/notification.processor.js';

import type {
  NotificationDeliveryResult,
  NotificationProvider,
} from './notification-provider.types.js';

import {
  NotificationFailureClassification,
} from './notification-provider-result.types.js';

export class PushNotificationProvider
  implements NotificationProvider
{
  readonly channel =
    'push' as const;

  constructor(
    private readonly logger:
      GurusthalamLogger,
  ) {}

  async send(
    notification:
      NotificationJobData,
  ): Promise<NotificationDeliveryResult> {
    const messageId =
      `dev-push-${notification.notificationId}`;

    this.logger.info(
      `DEV push provider accepted notification ${notification.notificationId}`,
      {
        operation:
          'notification.provider.push.accepted',

        service:
          'push',
      },
    );

    return {
      accepted:
        true,

      provider:
        'development-push',

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