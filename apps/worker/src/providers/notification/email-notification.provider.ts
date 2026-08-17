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

export class EmailNotificationProvider
  implements NotificationProvider
{
  readonly channel = 'email' as const;

  constructor(
    private readonly logger:
      GurusthalamLogger,
  ) {}

  async send(
    notification: NotificationJobData,
  ): Promise<NotificationDeliveryResult> {
    const messageId =
      `dev-email-${notification.notificationId}`;

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
    };
  }
}