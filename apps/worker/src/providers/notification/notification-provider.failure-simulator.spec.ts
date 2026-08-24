import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  NotificationProviderFailureSimulator,
} from './notification-provider.failure-simulator.js';

import {
  NotificationFailureClassification,
} from './notification-provider-result.types.js';

describe(
  'NotificationProviderFailureSimulator',
  () => {
    it(
      'is disabled by default',
      () => {
        const simulator =
          new NotificationProviderFailureSimulator({
            mode:
              'disabled',
          });

        expect(
          simulator.isEnabled(),
        ).toBe(
          false,
        );

        expect(
          simulator.simulate(
            'development-email',
            'email',
            'notification-001',
          ),
        ).toBeNull();
      },
    );

    it(
      'simulates RETRYABLE failures',
      () => {
        const simulator =
          new NotificationProviderFailureSimulator({
            mode:
              'retryable',
          });

        const result =
          simulator.simulate(
            'development-email',
            'email',
            'notification-002',
          );

        expect(
          result,
        ).toMatchObject({
          accepted:
            false,

          classification:
            NotificationFailureClassification.RETRYABLE,
        });
      },
    );

    it(
      'simulates RATE_LIMITED failures with retryAfterMs',
      () => {
        const simulator =
          new NotificationProviderFailureSimulator({
            mode:
              'rate_limited',

            retryAfterMs:
              7_500,
          });

        const result =
          simulator.simulate(
            'development-email',
            'email',
            'notification-003',
          );

        expect(
          result,
        ).toMatchObject({
          accepted:
            false,

          classification:
            NotificationFailureClassification.RATE_LIMITED,

          retryAfterMs:
            7_500,
        });
      },
    );

    it(
      'simulates NON_RETRYABLE failures',
      () => {
        const simulator =
          new NotificationProviderFailureSimulator({
            mode:
              'non_retryable',
          });

        const result =
          simulator.simulate(
            'development-email',
            'email',
            'notification-004',
          );

        expect(
          result?.classification,
        ).toBe(
          NotificationFailureClassification.NON_RETRYABLE,
        );
      },
    );

    it(
      'simulates PERMANENT failures',
      () => {
        const simulator =
          new NotificationProviderFailureSimulator({
            mode:
              'permanent',
          });

        const result =
          simulator.simulate(
            'development-email',
            'email',
            'notification-005',
          );

        expect(
          result?.classification,
        ).toBe(
          NotificationFailureClassification.PERMANENT,
        );
      },
    );
  },
);