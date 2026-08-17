import type {
  NotificationJobData,
} from '../../processors/notification.processor.js';

import type {
  NotificationProviderResult,
} from './notification-provider-result.types.js';

export type NotificationProviderChannel =
  | 'email'
  | 'in-app'
  | 'push';

export type NotificationDeliveryResult =
  NotificationProviderResult;

export interface NotificationSendContext {
  readonly deliveryKey: string;
}

export interface NotificationProvider {
  readonly channel:
    NotificationProviderChannel;

  send(
    notification:
      NotificationJobData,

    context:
      NotificationSendContext,
  ): Promise<NotificationDeliveryResult>;
}