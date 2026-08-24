import {
  NotificationProviderError,
} from './notification-provider.error.js';

import type {
  NotificationProvider,
  NotificationSendContext,
  NotificationDeliveryResult,
} from './notification-provider.types.js';

import {
  assertNotificationProviderResult,
} from './notification-provider.contract.js';

import {
  NotificationProviderFailureSimulator,
} from './notification-provider.failure-simulator.js';

import {
  EmailNotificationProvider,
} from './email-notification.provider.js';

import {
  InAppNotificationProvider,
} from './in-app-notification.provider.js';

import {
  PushNotificationProvider,
} from './push-notification.provider.js';

import {
  NotificationFailureClassification,
} from './notification-provider-result.types.js';

import type {
  NotificationJobData,
  NotificationChannel,
} from '../../processors/notification.processor.js';

export class NotificationProviderRegistry {
  private readonly providers =
    new Map<
      NotificationChannel,
      NotificationProvider
    >();

  constructor(
    emailProvider:
      EmailNotificationProvider,

    inAppProvider:
      InAppNotificationProvider,

    pushProvider:
      PushNotificationProvider,

    private readonly failureSimulator:
      NotificationProviderFailureSimulator =
        new NotificationProviderFailureSimulator(),
  ) {
    this.register(
      emailProvider,
    );

    this.register(
      inAppProvider,
    );

    this.register(
      pushProvider,
    );
  }

  private register(
    provider:
      NotificationProvider,
  ):
    void {
    this.providers.set(
      provider.channel,

      this.wrapProvider(
        provider,
      ),
    );
  }

  private wrapProvider(
    provider:
      NotificationProvider,
  ):
    NotificationProvider {
    return {
      channel:
        provider.channel,

      send:
        async (
          notification:
            NotificationJobData,

          context:
            NotificationSendContext,
        ):
          Promise<NotificationDeliveryResult> => {
          const simulated =
            this.failureSimulator.simulate(
              this.providerName(
                provider,
              ),

              notification.channel,

              notification.notificationId,
            );

          if (
            simulated
          ) {
            assertNotificationProviderResult(
              simulated,
            );

            return simulated;
          }

          const result =
            await provider.send(
              notification,

              context,
            );

          try {
            assertNotificationProviderResult(
              result,
            );
          } catch (
            error: unknown
          ) {
            throw new NotificationProviderError(
              `Provider "${this.providerName(provider)}" returned an invalid notification result.`,
              {
                cause:
                  error,
              },
            );
          }

          if (
            result.channel !==
            notification.channel
          ) {
            throw new NotificationProviderError(
              `Provider "${this.providerName(provider)}" returned channel "${result.channel}" for notification channel "${notification.channel}".`,
            );
          }

          if (
            result.notificationId !==
            notification.notificationId
          ) {
            throw new NotificationProviderError(
              `Provider "${this.providerName(provider)}" returned notificationId "${result.notificationId}" for notification "${notification.notificationId}".`,
            );
          }

          if (
            result.classification ===
              NotificationFailureClassification.SUCCESS &&
            result.provider !==
              this.providerName(
                provider,
              )
          ) {
            throw new NotificationProviderError(
              `Provider "${this.providerName(provider)}" returned provider identity "${result.provider}".`,
            );
          }

          return result;
        },
    };
  }

  private providerName(
    provider:
      NotificationProvider,
  ):
    string {
    switch (
      provider.channel
    ) {
      case 'email':
        return 'development-email';

      case 'in-app':
        return 'development-in-app';

      case 'push':
        return 'development-push';
    }
  }

  get(
    channel:
      NotificationChannel,
  ):
    NotificationProvider {
    const provider =
      this.providers.get(
        channel,
      );

    if (
      !provider
    ) {
      throw new NotificationProviderError(
        `No notification provider is registered for channel "${channel}".`,
      );
    }

    return provider;
  }

  getFailureSimulationMode():
    string {
    return this.failureSimulator.mode;
  }
}