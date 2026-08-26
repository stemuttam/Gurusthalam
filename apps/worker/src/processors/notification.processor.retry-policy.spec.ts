import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  Job,
} from 'bullmq';

import {
  NotificationProcessor,
  type NotificationJobData,
} from './notification.processor.js';

import {
  NotificationFailureClassification,
} from '../providers/notification/notification-provider-result.types.js';

function createNotificationData(
  overrides:
    Partial<NotificationJobData> = {},
):
  NotificationJobData {
  return {
    notificationId:
      'notification-policy-001',

    channel:
      'email',

    recipient: {
      userId:
        'user-policy-001',

      email:
        'test@example.com',
    },

    body:
      'Retry policy test',

    idempotencyKey:
      'idempotency-policy-001',

    ...overrides,
  };
}

function createJob(
  data:
    NotificationJobData,

  attemptsMade =
    0,
):
  Job<NotificationJobData> {
  return {
    data,

    attemptsMade,

    id:
      'notification-policy-test-job',
  } as Job<NotificationJobData>;
}

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

function createProcessor(
  primaryProviderResult:
    unknown,

  fallbackProviderResults:
    Partial<
      Record<
        'email' |
        'push' |
        'in-app',
        unknown
      >
    > = {},
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

  const primaryProvider:
    TestProvider = {
    send:
      vi.fn().mockResolvedValue(
        primaryProviderResult,
      ),
  };

  const fallbackProviders =
    new Map<
      string,
      TestProvider
    >();

  for (
    const channel of [
      'email',
      'push',
      'in-app',
    ]
  ) {
    if (
      channel ===
      'email'
    ) {
      fallbackProviders.set(
        channel,

        primaryProvider,
      );

      continue;
    }

    fallbackProviders.set(
      channel,

      {
        send:
          vi.fn().mockResolvedValue(
            fallbackProviderResults[
              channel as
                'push' |
                'in-app'
            ],
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
        ) =>
          getTestProvider(
            fallbackProviders,

            channel,
          ),
      ),
  };

  const persistence = {
    markProcessing:
      vi.fn().mockResolvedValue(
        undefined,
      ),

    markSent:
      vi.fn().mockResolvedValue(
        undefined,
      ),

    markRetrying:
      vi.fn().mockResolvedValue(
        undefined,
      ),

    markFailed:
      vi.fn().mockResolvedValue(
        undefined,
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

  const metrics = {
  incrementProcessing:
    vi.fn(),

  incrementIdempotentHits:
    vi.fn(),

  incrementProviderIdempotentHits:
    vi.fn(),

  incrementProviderErrorsFor:
    vi.fn(),

  incrementRetrying:
    vi.fn(),

  incrementProviderRetrying:
    vi.fn(),

  incrementSent:
    vi.fn(),

  incrementProviderSent:
    vi.fn(),

  incrementFailed:
    vi.fn(),

  incrementProviderFailed:
    vi.fn(),

  recordLatency:
    vi.fn(),

  recordProviderLatency:
    vi.fn(),

  incrementFallbackStarted:
    vi.fn(),

  incrementFallbackAttempts:
    vi.fn(),

  incrementFallbackAttemptFailures:
    vi.fn(),

  incrementFallbackRecovered:
    vi.fn(),

  incrementFallbackExhausted:
    vi.fn(),

  incrementFallbackIdempotentHits:
    vi.fn(),
};

  const processor =
    new NotificationProcessor(
      logger as never,

      providerRegistry as never,

      persistence as never,

      deliveryPersistence as never,

      metrics as never,
    );

  return {
    processor,

    primaryProvider,

    providerRegistry,

    persistence,

    deliveryPersistence,

    metrics,

    fallbackProviders,
  };
}

function createFallbackMetadata() {
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

describe(
  'NotificationProcessor - provider retry policy',
  () => {
    it(
      'retries a RETRYABLE provider response',
      async () => {
        const {
          processor,
          persistence,
          deliveryPersistence,
        } =
          createProcessor({
            accepted:
              false,

            provider:
              'development-email',

            channel:
              'email',

            notificationId:
              'notification-policy-001',

            classification:
              NotificationFailureClassification.RETRYABLE,

            errorMessage:
              'Temporary provider failure.',
          });

        const promise =
          processor.process(
            createJob(
              createNotificationData(),
            ),
          );

        await expect(
          promise,
        ).rejects.toThrow(
          'Temporary provider failure.',
        );

        expect(
          persistence.markRetrying,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          deliveryPersistence.markFailed,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    it(
      'retries a RATE_LIMITED provider response',
      async () => {
        const {
          processor,
          persistence,
          deliveryPersistence,
        } =
          createProcessor({
            accepted:
              false,

            provider:
              'development-email',

            channel:
              'email',

            notificationId:
              'notification-policy-001',

            classification:
              NotificationFailureClassification.RATE_LIMITED,

            retryAfterMs:
              12_000,

            errorMessage:
              'Provider rate limit reached.',
          });

        const promise =
          processor.process(
            createJob(
              createNotificationData(),
            ),
          );

        await expect(
          promise,
        ).rejects.toThrow(
          'Provider rate limit reached.',
        );

        expect(
          persistence.markRetrying,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          deliveryPersistence.markFailed,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    it(
      'does not retry NON_RETRYABLE provider failures',
      async () => {
        const {
          processor,
          persistence,
          deliveryPersistence,
        } =
          createProcessor({
            accepted:
              false,

            provider:
              'development-email',

            channel:
              'email',

            notificationId:
              'notification-policy-001',

            classification:
              NotificationFailureClassification.NON_RETRYABLE,

            errorMessage:
              'Invalid recipient.',
          });

        const result =
          await processor.process(
            createJob(
              createNotificationData(),
            ),
          );

        expect(
          result.processed,
        ).toBe(
          true,
        );

        expect(
          persistence.markFailed,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          persistence.markRetrying,
        ).not.toHaveBeenCalled();

        expect(
          deliveryPersistence.markFailed,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    it(
      'does not retry PERMANENT provider failures',
      async () => {
        const {
          processor,
          persistence,
          deliveryPersistence,
        } =
          createProcessor({
            accepted:
              false,

            provider:
              'development-email',

            channel:
              'email',

            notificationId:
              'notification-policy-001',

            classification:
              NotificationFailureClassification.PERMANENT,

            errorMessage:
              'Provider permanently rejected the message.',
          });

        const result =
          await processor.process(
            createJob(
              createNotificationData(),
            ),
          );

        expect(
          result.processed,
        ).toBe(
          true,
        );

        expect(
          persistence.markFailed,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          persistence.markRetrying,
        ).not.toHaveBeenCalled();

        expect(
          deliveryPersistence.markFailed,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    it(
      'stops classified retries at the policy maximum',
      async () => {
        const {
          processor,
          persistence,
          deliveryPersistence,
        } =
          createProcessor({
            accepted:
              false,

            provider:
              'development-email',

            channel:
              'email',

            notificationId:
              'notification-policy-001',

            classification:
              NotificationFailureClassification.RETRYABLE,

            errorMessage:
              'Retry limit reached.',
          });

        const result =
          await processor.process(
            createJob(
              createNotificationData(),

              2,
            ),
          );

        expect(
          result.processed,
        ).toBe(
          true,
        );

        expect(
          persistence.markFailed,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          persistence.markRetrying,
        ).not.toHaveBeenCalled();

        expect(
          deliveryPersistence.markFailed,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    it(
      'executes the first fallback after primary retry exhaustion',
      async () => {
        const {
          processor,
          primaryProvider,
          fallbackProviders,
          persistence,
        } =
          createProcessor(
            {
              accepted:
                false,

              provider:
                'development-email',

              channel:
                'email',

              notificationId:
                'notification-policy-001',

              classification:
                NotificationFailureClassification.RETRYABLE,

              errorMessage:
                'Primary provider retry budget exhausted.',
            },

            {
              push: {
                accepted:
                  true,

                provider:
                  'development-push',

                channel:
                  'push',

                notificationId:
                  'notification-policy-001',

                messageId:
                  'fallback-push-message-001',

                classification:
                  NotificationFailureClassification.SUCCESS,
              },
            },
          );

        const result =
          await processor.process(
            createJob(
              createNotificationData({
                fallbackMetadata:
                  createFallbackMetadata(),
              }),

              2,
            ),
          );

        expect(
          result,
        ).toEqual({
          processed:
            true,

          notificationId:
            'notification-policy-001',

          channel:
            'push',

          provider:
            'development-push',

          messageId:
            'fallback-push-message-001',
        });

        expect(
          primaryProvider.send,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          getTestProvider(
            fallbackProviders,
            'push',
          ).send,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          getTestProvider(
            fallbackProviders,
            'in-app',
          ).send,
        ).not.toHaveBeenCalled();

        expect(
          persistence.markRetrying,
        ).not.toHaveBeenCalled();

        expect(
          persistence.markSent,
        ).toHaveBeenCalledWith(
          'notification-policy-001',

          'development-push',

          'fallback-push-message-001',
        );
      },
    );

    it(
      'does not execute fallback while primary retry remains available',
      async () => {
        const {
          processor,
          primaryProvider,
          fallbackProviders,
          persistence,
        } =
          createProcessor(
            {
              accepted:
                false,

              provider:
                'development-email',

              channel:
                'email',

              notificationId:
                'notification-policy-001',

              classification:
                NotificationFailureClassification.RETRYABLE,

              errorMessage:
                'Temporary primary provider failure.',
            },

            {
              push: {
                accepted:
                  true,

                provider:
                  'development-push',

                channel:
                  'push',

                notificationId:
                  'notification-policy-001',

                messageId:
                  'should-not-be-used',

                classification:
                  NotificationFailureClassification.SUCCESS,
              },
            },
          );

        const promise =
          processor.process(
            createJob(
              createNotificationData({
                fallbackMetadata:
                  createFallbackMetadata(),
              }),

              0,
            ),
          );

        await expect(
          promise,
        ).rejects.toThrow(
          'Temporary primary provider failure.',
        );

        expect(
          primaryProvider.send,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          getTestProvider(
            fallbackProviders,
            'push',
          ).send,
        ).not.toHaveBeenCalled();

        expect(
          persistence.markRetrying,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    it(
      'marks the original notification SENT when fallback succeeds',
      async () => {
        const {
          processor,
          persistence,
          deliveryPersistence,
        } =
          createProcessor(
            {
              accepted:
                false,

              provider:
                'development-email',

              channel:
                'email',

              notificationId:
                'notification-policy-001',

              classification:
                NotificationFailureClassification.PERMANENT,

              errorMessage:
                'Primary provider permanently rejected message.',
            },

            {
              push: {
                accepted:
                  true,

                provider:
                  'development-push',

                channel:
                  'push',

                notificationId:
                  'notification-policy-001',

                messageId:
                  'fallback-message-001',

                classification:
                  NotificationFailureClassification.SUCCESS,
              },
            },
          );

        const result =
          await processor.process(
            createJob(
              createNotificationData({
                fallbackMetadata:
                  createFallbackMetadata(),
              }),
            ),
          );

        expect(
          result.processed,
        ).toBe(
          true,
        );

        expect(
          result.provider,
        ).toBe(
          'development-push',
        );

        expect(
          result.messageId,
        ).toBe(
          'fallback-message-001',
        );

        expect(
          persistence.markSent,
        ).toHaveBeenCalledWith(
          'notification-policy-001',

          'development-push',

          'fallback-message-001',
        );

        expect(
          persistence.markFailed,
        ).not.toHaveBeenCalled();

        expect(
          deliveryPersistence.markSent,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    it(
      'keeps the original notification FAILED when all fallbacks fail',
      async () => {
        const {
          processor,
          persistence,
          deliveryPersistence,
          fallbackProviders,
        } =
          createProcessor(
            {
              accepted:
                false,

              provider:
                'development-email',

              channel:
                'email',

              notificationId:
                'notification-policy-001',

              classification:
                NotificationFailureClassification.PERMANENT,

              errorMessage:
                'Primary provider permanently rejected message.',
            },

            {
              push: {
                accepted:
                  false,

                provider:
                  'development-push',

                channel:
                  'push',

                notificationId:
                  'notification-policy-001',

                classification:
                  NotificationFailureClassification.PERMANENT,

                errorMessage:
                  'Push fallback failed.',
              },

              'in-app': {
                accepted:
                  false,

                provider:
                  'development-in-app',

                channel:
                  'in-app',

                notificationId:
                  'notification-policy-001',

                classification:
                  NotificationFailureClassification.NON_RETRYABLE,

                errorMessage:
                  'In-app fallback failed.',
              },
            },
          );

        const result =
          await processor.process(
            createJob(
              createNotificationData({
                fallbackMetadata:
                  createFallbackMetadata(),
              }),
            ),
          );

        expect(
          result.processed,
        ).toBe(
          true,
        );

        expect(
          result.provider,
        ).toBe(
          'development-email',
        );

        expect(
          result.messageId,
        ).toBe(
          'failed-notification-policy-001',
        );

        expect(
          getTestProvider(
            fallbackProviders,
            'push',
          ).send,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          getTestProvider(
            fallbackProviders,
            'in-app',
          ).send,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          deliveryPersistence.markFailed,
        ).toHaveBeenCalledTimes(
          3,
        );

        expect(
          persistence.markFailed,
        ).toHaveBeenCalledWith(
          'notification-policy-001',

          expect.any(
            String,
          ),

          1,
        );

        expect(
          persistence.markSent,
        ).not.toHaveBeenCalled();
      },
    );
  },
);