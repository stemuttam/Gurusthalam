import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  assertNotificationProviderResult,
} from './notification-provider.contract.js';

import {
  NotificationFailureClassification,
} from './notification-provider-result.types.js';

function createValidResult() {
  return {
    accepted:
      true,

    provider:
      'development-email',

    channel:
      'email',

    notificationId:
      'notification-contract-001',

    messageId:
      'message-contract-001',

    classification:
      NotificationFailureClassification.SUCCESS,
  };
}

describe(
  'Notification provider result contract',
  () => {
    it(
      'accepts a valid SUCCESS result',
      () => {
        expect(
          () =>
            assertNotificationProviderResult(
              createValidResult(),
            ),
        ).not.toThrow();
      },
    );

    it(
      'rejects an accepted result without messageId',
      () => {
        const result =
          createValidResult();

        delete (
          result as {
            messageId?:
              string;
          }
        ).messageId;

        expect(
          () =>
            assertNotificationProviderResult(
              result,
            ),
        ).toThrow(
          'must include a messageId',
        );
      },
    );

    it(
      'rejects SUCCESS with accepted=false',
      () => {
        expect(
          () =>
            assertNotificationProviderResult({
              ...createValidResult(),

              accepted:
                false,
            }),
        ).toThrow(
          'accepted=true',
        );
      },
    );

    it(
      'requires retryAfterMs for RATE_LIMITED',
      () => {
        expect(
          () =>
            assertNotificationProviderResult({
              accepted:
                false,

              provider:
                'development-email',

              channel:
                'email',

              notificationId:
                'notification-contract-002',

              classification:
                NotificationFailureClassification.RATE_LIMITED,

              errorMessage:
                'Rate limited',
            }),
        ).toThrow(
          'RATE_LIMITED',
        );
      },
    );

    it(
      'accepts a valid RATE_LIMITED result',
      () => {
        expect(
          () =>
            assertNotificationProviderResult({
              accepted:
                false,

              provider:
                'development-email',

              channel:
                'email',

              notificationId:
                'notification-contract-003',

              classification:
                NotificationFailureClassification.RATE_LIMITED,

              errorCode:
                'RATE_LIMIT',

              errorMessage:
                'Rate limited',

              retryAfterMs:
                5_000,
            }),
        ).not.toThrow();
      },
    );

    it(
      'rejects an unsupported classification',
      () => {
        expect(
          () =>
            assertNotificationProviderResult({
              ...createValidResult(),

              classification:
                'UNKNOWN',
            }),
        ).toThrow(
          'unsupported failure classification',
        );
      },
    );

    it(
      'rejects channel mismatches at the registry boundary',
      () => {
        expect(
          () =>
            assertNotificationProviderResult({
              ...createValidResult(),

              channel:
                '',
            }),
        ).toThrow();
      },
    );
  },
);