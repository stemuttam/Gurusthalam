import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  NotificationFailureClassification,
} from '../providers/notification/notification-provider-result.types.js';

import {
  NotificationFallbackExecutor,
} from './notification-fallback.executor.js';

import type {
  NotificationJobData,
} from '../processors/notification.processor.js';

interface TestProvider {
  readonly send:
    ReturnType<
      typeof vi.fn
    >;
}

function getTestProvider(
  providers:
    Map<
      string,
      TestProvider
    >,

  channel:
    string,
):
  TestProvider {
  const provider =
    providers.get(
      channel,
    );

  if (
    provider ===
    undefined
  ) {
    throw new Error(
      `Test provider "${channel}" was not registered.`,
    );
  }

  return provider;
}

function createNotification():
  NotificationJobData {
  return {
    notificationId:
      'fallback-execution-001',

    channel:
      'email',

    recipient: {
      userId:
        'fallback-user-001',

      email:
        'fallback@example.com',
    },

    body:
      'Fallback execution test',

    idempotencyKey:
      'fallback-execution-key:email',
  };
}

function createMetadata() {
  return {
    planId:
      'fallback-plan-001',

    orchestrationId:
      'fallback-orchestration-001',

    primary:
      'email' as const,

    fallbacks: [
      'push' as const,
      'in-app' as const,
    ],

    sequence: [
      'email' as const,
      'push' as const,
      'in-app' as const,
    ],

    position:
      0,
  };
}

function createExecutor(
  providerResults:
    Record<
      string,
      unknown
    >,
) {
  const logger = {
    info:
      vi.fn(),

    warn:
      vi.fn(),

    error:
      vi.fn(),

    debug:
      vi.fn(),
  };

  const providers =
    new Map<
      string,
      TestProvider
    >();

  for (
    const channel of [
      'push',
      'in-app',
    ]
  ) {
    providers.set(
      channel,
      {
        send:
          vi.fn().mockResolvedValue(
            providerResults[channel],
          ),
      },
    );
  }

  const providerRegistry = {
    get:
      vi.fn(
        (
          channel:
            'email' |
            'push' |
            'in-app',
        ) => {
          const provider =
            providers.get(
              channel,
            );

          if (
            provider ===
            undefined
          ) {
            throw new Error(
              `Test provider "${channel}" was not registered.`,
            );
          }

          return provider;
        },
      ),
  };

  const deliveryPersistence = {
    createIfMissing:
      vi.fn().mockResolvedValue(
        undefined,
      ),

    getByDeliveryKey:
      vi.fn().mockResolvedValue(
        null,
      ),

    markProcessing:
      vi.fn().mockResolvedValue(
        undefined,
      ),

    markSent:
      vi.fn().mockResolvedValue(
        undefined,
      ),

    markFailed:
      vi.fn().mockResolvedValue(
        undefined,
      ),
  };

  const executor =
    new NotificationFallbackExecutor(
      logger as never,

      providerRegistry as never,

      deliveryPersistence as never,
    );

  return {
    executor,

    providers,

    providerRegistry,

    deliveryPersistence,
  };
}

describe(
  'NotificationFallbackExecutor',
  () => {
    it(
      'uses the first successful fallback channel',
      async () => {
        const {
          executor,
          providers,
          deliveryPersistence,
        } =
          createExecutor({
            push: {
              accepted:
                true,

              provider:
                'development-push',

              channel:
                'push',

              notificationId:
                'fallback-execution-001',

              messageId:
                'push-message-001',

              classification:
                NotificationFailureClassification.SUCCESS,
            },

            'in-app': {
              accepted:
                true,

              provider:
                'development-in-app',

              channel:
                'in-app',

              notificationId:
                'fallback-execution-001',

              messageId:
                'inapp-message-001',

              classification:
                NotificationFailureClassification.SUCCESS,
            },
          });

        const result =
          await executor.execute(
            createNotification(),

            createMetadata(),

            3,
          );

        expect(
          result,
        ).toEqual({
          channel:
            'push',

          provider:
            'development-push',

          messageId:
            'push-message-001',
        });

        expect(
          getTestProvider(
            providers,
            'push',
          ).send,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          getTestProvider(
            providers,
            'in-app',
          ).send,
        ).not.toHaveBeenCalled();

        expect(
          deliveryPersistence.markSent,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    it(
      'continues to the next fallback after a failed fallback',
      async () => {
        const {
          executor,
          providers,
        } =
          createExecutor({
            push: {
              accepted:
                false,

              provider:
                'development-push',

              channel:
                'push',

              notificationId:
                'fallback-execution-001',

              classification:
                NotificationFailureClassification.PERMANENT,

              errorMessage:
                'Push permanently rejected.',
            },

            'in-app': {
              accepted:
                true,

              provider:
                'development-in-app',

              channel:
                'in-app',

              notificationId:
                'fallback-execution-001',

              messageId:
                'inapp-message-001',

              classification:
                NotificationFailureClassification.SUCCESS,
            },
          });

        const result =
          await executor.execute(
            createNotification(),

            createMetadata(),

            3,
          );

        expect(
          result?.channel,
        ).toBe(
          'in-app',
        );

        expect(
          getTestProvider(
            providers,
            'push',
          ).send,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          getTestProvider(
            providers,
            'in-app',
          ).send,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    it(
      'returns null when every fallback fails',
      async () => {
        const {
          executor,
          deliveryPersistence,
        } =
          createExecutor({
            push: {
              accepted:
                false,

              provider:
                'development-push',

              channel:
                'push',

              notificationId:
                'fallback-execution-001',

              classification:
                NotificationFailureClassification.PERMANENT,

              errorMessage:
                'Push failed.',
            },

            'in-app': {
              accepted:
                false,

              provider:
                'development-in-app',

              channel:
                'in-app',

              notificationId:
                'fallback-execution-001',

              classification:
                NotificationFailureClassification.NON_RETRYABLE,

              errorMessage:
                'In-app failed.',
            },
          });

        const result =
          await executor.execute(
            createNotification(),

            createMetadata(),

            3,
          );

        expect(
          result,
        ).toBeNull();

        expect(
          deliveryPersistence.markFailed,
        ).toHaveBeenCalledTimes(
          2,
        );
      },
    );

    it(
      'skips already-sent fallback deliveries idempotently',
      async () => {
        const {
          executor,
          providers,
          deliveryPersistence,
        } =
          createExecutor({
            push: {
              accepted:
                true,

              provider:
                'development-push',

              channel:
                'push',

              notificationId:
                'fallback-execution-001',

              messageId:
                'unused',

              classification:
                NotificationFailureClassification.SUCCESS,
            },

            'in-app': {
              accepted:
                true,

              provider:
                'development-in-app',

              channel:
                'in-app',

              notificationId:
                'fallback-execution-001',

              messageId:
                'unused',

              classification:
                NotificationFailureClassification.SUCCESS,
            },
          });

        deliveryPersistence.getByDeliveryKey.mockResolvedValueOnce({
          status:
            'SENT',

          providerMessageId:
            'existing-push-message',
        });

        const result =
          await executor.execute(
            createNotification(),

            createMetadata(),

            3,
          );

        expect(
          result,
        ).toEqual({
          channel:
            'push',

          provider:
            'development-push',

          messageId:
            'existing-push-message',
        });

        expect(
          getTestProvider(
            providers,
            'push',
          ).send,
        ).not.toHaveBeenCalled();
      },
    );
  },
);