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

function createNotificationData(): NotificationJobData {
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
  };
}

function createJob(
  data:
    NotificationJobData,

  attemptsMade =
    0,
): Job<NotificationJobData> {
  return {
    data,

    attemptsMade,

    id:
      'notification-policy-test-job',
  } as Job<NotificationJobData>;
}

function createProcessor(
  providerResult:
    unknown,
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

  const provider = {
    send:
      vi.fn().mockResolvedValue(
        providerResult,
      ),
  };

  const providerRegistry = {
    get:
      vi.fn().mockReturnValue(
        provider,
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

    provider,

    providerRegistry,

    persistence,

    deliveryPersistence,

    metrics,
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
  },
);