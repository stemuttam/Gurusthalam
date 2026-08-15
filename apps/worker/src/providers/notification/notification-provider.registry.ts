import {
  NotificationProviderError,
} from './notification-provider.error.js';

import type {
  NotificationProvider,
} from './notification-provider.types.js';

import {
  EmailNotificationProvider,
} from './email-notification.provider.js';

import {
  InAppNotificationProvider,
} from './in-app-notification.provider.js';

import {
  PushNotificationProvider,
} from './push-notification.provider.js';

import type {
  NotificationChannel,
} from '../../processors/notification.processor.js';

export class NotificationProviderRegistry {
  private readonly providers =
    new Map<
      NotificationChannel,
      NotificationProvider
    >();

  constructor(
    emailProvider: EmailNotificationProvider,
    inAppProvider: InAppNotificationProvider,
    pushProvider: PushNotificationProvider,
  ) {
    this.register(emailProvider);
    this.register(inAppProvider);
    this.register(pushProvider);
  }

  private register(
    provider: NotificationProvider,
  ): void {
    this.providers.set(
      provider.channel,
      provider,
    );
  }

  get(
    channel: NotificationChannel,
  ): NotificationProvider {
    const provider =
      this.providers.get(channel);

    if (!provider) {
      throw new NotificationProviderError(
        `No notification provider is registered for channel "${channel}".`,
      );
    }

    return provider;
  }
}