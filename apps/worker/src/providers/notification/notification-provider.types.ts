import type {
  NotificationJobData,
} from '../../processors/notification.processor.js';

export interface NotificationDeliveryResult {
  readonly accepted: boolean;
  readonly provider: string;
  readonly channel: NotificationJobData['channel'];
  readonly notificationId: string;
  readonly messageId: string;
}

export interface NotificationProvider {
  readonly channel: NotificationJobData['channel'];

  send(
    notification: NotificationJobData,
  ): Promise<NotificationDeliveryResult>;
}