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

export class InAppNotificationProvider
  implements NotificationProvider
{
  readonly channel = 'in-app' as const;

  constructor(
    private readonly logger: GurusthalamLogger,
  ) {}

  async send(
    notification: NotificationJobData,
  ): Promise<NotificationDeliveryResult> {
    const messageId =
      `dev-in-app-${notification.notificationId}`;

    this.logger.info(
      `DEV in-app provider accepted notification ${notification.notificationId}`,
      {
        operation:
          'notification.provider.in-app.accepted',
        service: 'in-app',
      },
    );

    return {
      accepted: true,
      provider: 'development-in-app',
      channel: notification.channel,
      notificationId:
        notification.notificationId,
      messageId,
    };
  }
}