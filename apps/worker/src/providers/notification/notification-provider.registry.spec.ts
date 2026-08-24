import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  NotificationProviderRegistry,
} from './notification-provider.registry.js';

import {
  NotificationProviderFailureSimulator,
} from './notification-provider.failure-simulator.js';

import {
  NotificationFailureClassification,
} from './notification-provider-result.types.js';

function createLogger() {
  return {
    info:
      vi.fn(),

    warn:
      vi.fn(),

    error:
      vi.fn(),

    debug:
      vi.fn(),
  };
}

function createNotification() {
  return {
    notificationId:
      'registry-test-001',

    channel:
      'email' as const,

    recipient: {
      userId:
        'user-001',

      email:
        'test@example.com',
    },

    body:
      'Registry test',

    idempotencyKey:
      'registry-idempotency-001',
  };
}

function createProviders() {
  const logger =
    createLogger();

  const emailProvider = {
    channel:
      'email' as const,

    send:
      vi.fn().mockResolvedValue({
        accepted:
          true,

        provider:
          'development-email',

        channel:
          'email',

        notificationId:
          'registry-test-001',

        messageId:
          'dev-email-registry-test',

        classification:
          NotificationFailureClassification.SUCCESS,
      }),
  };

  const inAppProvider = {
    channel:
      'in-app' as const,

    send:
      vi.fn().mockResolvedValue({
        accepted:
          true,

        provider:
          'development-in-app',

        channel:
          'in-app',

        notificationId:
          'registry-test-001',

        messageId:
          'dev-in-app-registry-test',

        classification:
          NotificationFailureClassification.SUCCESS,
      }),
  };

  const pushProvider = {
    channel:
      'push' as const,

    send:
      vi.fn().mockResolvedValue({
        accepted:
          true,

        provider:
          'development-push',

        channel:
          'push',

        notificationId:
          'registry-test-001',

        messageId:
          'dev-push-registry-test',

        classification:
          NotificationFailureClassification.SUCCESS,
      }),
  };

  void logger;

  return {
    emailProvider,
    inAppProvider,
    pushProvider,
  };
}

describe(
  'NotificationProviderRegistry',
  () => {
    it(
      'returns the registered provider for a channel',
      async () => {
        const {
          emailProvider,
          inAppProvider,
          pushProvider,
        } =
          createProviders();

        const registry =
          new NotificationProviderRegistry(
            emailProvider as never,
            inAppProvider as never,
            pushProvider as never,
            new NotificationProviderFailureSimulator({
              mode:
                'disabled',
            }),
          );

        const provider =
          registry.get(
            'email',
          );

        const result =
          await provider.send(
            createNotification(),
            {
              deliveryKey:
                'delivery-registry-001',
            },
          );

        expect(
          result.classification,
        ).toBe(
          NotificationFailureClassification.SUCCESS,
        );
      },
    );

    it(
      'rejects invalid provider results',
      async () => {
        const {
          emailProvider,
          inAppProvider,
          pushProvider,
        } =
          createProviders();

        emailProvider.send =
          vi.fn().mockResolvedValue({
            accepted:
              true,

            provider:
              'development-email',

            channel:
              'email',

            notificationId:
              'registry-test-001',

            classification:
              NotificationFailureClassification.SUCCESS,
          });

        const registry =
          new NotificationProviderRegistry(
            emailProvider as never,
            inAppProvider as never,
            pushProvider as never,
            new NotificationProviderFailureSimulator({
              mode:
                'disabled',
            }),
          );

        await expect(
          registry
            .get(
              'email',
            )
            .send(
              createNotification(),
              {
                deliveryKey:
                  'delivery-registry-002',
              },
            ),
        ).rejects.toThrow(
          'invalid notification result',
        );
      },
    );

    it(
      'simulates RATE_LIMITED failures at the provider boundary',
      async () => {
        const {
          emailProvider,
          inAppProvider,
          pushProvider,
        } =
          createProviders();

        const registry =
          new NotificationProviderRegistry(
            emailProvider as never,
            inAppProvider as never,
            pushProvider as never,
            new NotificationProviderFailureSimulator({
              mode:
                'rate_limited',

              retryAfterMs:
                15_000,
            }),
          );

        const result =
          await registry
            .get(
              'email',
            )
            .send(
              createNotification(),
              {
                deliveryKey:
                  'delivery-registry-003',
              },
            );

        expect(
          result.classification,
        ).toBe(
          NotificationFailureClassification.RATE_LIMITED,
        );

        expect(
          result.retryAfterMs,
        ).toBe(
          15_000,
        );

        expect(
          emailProvider.send,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'simulates terminal provider failures without invoking transport',
      async () => {
        const {
          emailProvider,
          inAppProvider,
          pushProvider,
        } =
          createProviders();

        const registry =
          new NotificationProviderRegistry(
            emailProvider as never,
            inAppProvider as never,
            pushProvider as never,
            new NotificationProviderFailureSimulator({
              mode:
                'permanent',
            }),
          );

        const result =
          await registry
            .get(
              'email',
            )
            .send(
              createNotification(),
              {
                deliveryKey:
                  'delivery-registry-004',
              },
            );

        expect(
          result.classification,
        ).toBe(
          NotificationFailureClassification.PERMANENT,
        );

        expect(
          emailProvider.send,
        ).not.toHaveBeenCalled();
      },
    );
  },
);