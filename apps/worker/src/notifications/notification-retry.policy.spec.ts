import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  decideNotificationRetry,
  getNotificationBackoffDelay,
  getNotificationRetryDelay,
  getNotificationRetryPolicy,
  getProviderAwareRetryDelay,
  getRateLimitRetryDelay,
  isRetryableNotificationClassification,
  isTerminalNotificationClassification,
  NOTIFICATION_RETRY_BACKOFF_TYPE,
} from './notification-retry.policy.js';

import {
  NotificationFailureClassification,
} from '../providers/notification/notification-provider-result.types.js';

describe(
  'notification retry policy',
  () => {
    const policy =
      getNotificationRetryPolicy();

    it(
      'uses exponential backoff for ordinary retryable failures',
      () => {
        expect(
          getNotificationRetryDelay(
            1,
            policy,
          ),
        ).toBe(
          0,
        );

        expect(
          getNotificationRetryDelay(
            2,
            policy,
          ),
        ).toBe(
          1_000,
        );

        expect(
          getNotificationRetryDelay(
            3,
            policy,
          ),
        ).toBe(
          2_000,
        );
      },
    );

    it(
      'recognizes retryable classifications',
      () => {
        expect(
          isRetryableNotificationClassification(
            NotificationFailureClassification.RETRYABLE,
          ),
        ).toBe(
          true,
        );

        expect(
          isRetryableNotificationClassification(
            NotificationFailureClassification.RATE_LIMITED,
          ),
        ).toBe(
          true,
        );

        expect(
          isRetryableNotificationClassification(
            NotificationFailureClassification.PERMANENT,
          ),
        ).toBe(
          false,
        );
      },
    );

    it(
      'recognizes terminal classifications',
      () => {
        expect(
          isTerminalNotificationClassification(
            NotificationFailureClassification.NON_RETRYABLE,
          ),
        ).toBe(
          true,
        );

        expect(
          isTerminalNotificationClassification(
            NotificationFailureClassification.PERMANENT,
          ),
        ).toBe(
          true,
        );

        expect(
          isTerminalNotificationClassification(
            NotificationFailureClassification.RETRYABLE,
          ),
        ).toBe(
          false,
        );
      },
    );

    it(
      'clamps provider retryAfterMs to the retry policy maximum',
      () => {
        expect(
          getRateLimitRetryDelay(
            30_000,
            policy,
          ),
        ).toBe(
          30_000,
        );

        expect(
          getRateLimitRetryDelay(
            120_000,
            policy,
          ),
        ).toBe(
          60_000,
        );
      },
    );

    it(
      'falls back to the normal retry delay when retryAfterMs is absent',
      () => {
        expect(
          getRateLimitRetryDelay(
            undefined,
            policy,
          ),
        ).toBe(
          1_000,
        );
      },
    );

    it(
      'uses retryAfterMs for RATE_LIMITED provider responses',
      () => {
        expect(
          getProviderAwareRetryDelay(
            2,

            NotificationFailureClassification.RATE_LIMITED,

            7_500,

            policy,
          ),
        ).toBe(
          7_500,
        );
      },
    );

    it(
      'uses exponential delay for ordinary RETRYABLE responses',
      () => {
        expect(
          getProviderAwareRetryDelay(
            3,

            NotificationFailureClassification.RETRYABLE,

            7_500,

            policy,
          ),
        ).toBe(
          2_000,
        );
      },
    );

    it(
      'stops retrying when the policy attempt limit is reached',
      () => {
        const decision =
          decideNotificationRetry(
            NotificationFailureClassification.RETRYABLE,

            policy.maxAttempts,

            policy,
          );

        expect(
          decision.shouldRetry,
        ).toBe(
          false,
        );

        expect(
          decision.terminal,
        ).toBe(
          true,
        );
      },
    );

    it(
      'returns a custom BullMQ backoff delay for a rate-limited error',
      () => {
        const error =
          Object.assign(
            new Error(
              'Rate limited',
            ),
            {
              classification:
                NotificationFailureClassification.RATE_LIMITED,

              retryAfterMs:
                12_345,
            },
          );

        expect(
          getNotificationBackoffDelay(
            1,

            error,

            policy,
          ),
        ).toBe(
          12_345,
        );
      },
    );

    it(
      'uses normal exponential BullMQ backoff for generic errors',
      () => {
        const error =
          new Error(
            'Network failure',
          );

        expect(
          getNotificationBackoffDelay(
            1,

            error,

            policy,
          ),
        ).toBe(
          1_000,
        );

        expect(
          getNotificationBackoffDelay(
            2,

            error,

            policy,
          ),
        ).toBe(
          2_000,
        );
      },
    );

    it(
      'exports the expected BullMQ backoff type',
      () => {
        expect(
          NOTIFICATION_RETRY_BACKOFF_TYPE,
        ).toBe(
          'notification-policy',
        );
      },
    );
  },
);