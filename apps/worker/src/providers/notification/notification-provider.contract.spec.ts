import { describe, expect, it } from 'vitest';

import { assertNotificationProviderResult } from './notification-provider.contract.js';

import { NotificationFailureClassification } from './notification-provider-result.types.js';

function createValidResult() {
  return {
    accepted: true,
    provider: 'development-email',
    channel: 'email',
    notificationId: 'notification-contract-001',
    messageId: 'message-contract-001',
    classification: NotificationFailureClassification.SUCCESS,
  };
}

function createRejectedResult(
  classification: Exclude<
    NotificationFailureClassification,
    typeof NotificationFailureClassification.SUCCESS
  >,
) {
  return {
    accepted: false,
    provider: 'development-email',
    channel: 'email',
    notificationId: 'notification-contract-002',
    classification,
    errorCode: 'PROVIDER_REJECTED',
    errorMessage: 'The provider definitively rejected the request.',
    ...(classification === NotificationFailureClassification.RATE_LIMITED
      ? { retryAfterMs: 5_000 }
      : {}),
  };
}

describe('Notification provider result contract', () => {
  it('accepts a valid SUCCESS result', () => {
    expect(() =>
      assertNotificationProviderResult(createValidResult()),
    ).not.toThrow();
  });

  it('rejects an accepted result without messageId', () => {
    const result = { ...createValidResult() };
    Reflect.deleteProperty(result, 'messageId');

    expect(() => assertNotificationProviderResult(result)).toThrow(
      'must include a messageId',
    );
  });

  it.each([
    NotificationFailureClassification.RETRYABLE,
    NotificationFailureClassification.RATE_LIMITED,
    NotificationFailureClassification.NON_RETRYABLE,
    NotificationFailureClassification.PERMANENT,
  ])(
    'accepts accepted=false with the %s rejection classification',
    (classification) => {
      expect(() =>
        assertNotificationProviderResult(createRejectedResult(classification)),
      ).not.toThrow();
    },
  );

  it('rejects SUCCESS with accepted=false', () => {
    expect(() =>
      assertNotificationProviderResult({
        ...createValidResult(),
        accepted: false,
      }),
    ).toThrow('accepted=true');
  });

  it.each([
    NotificationFailureClassification.RETRYABLE,
    NotificationFailureClassification.RATE_LIMITED,
    NotificationFailureClassification.NON_RETRYABLE,
    NotificationFailureClassification.PERMANENT,
  ])('rejects accepted=true with the %s classification', (classification) => {
    expect(() =>
      assertNotificationProviderResult({
        ...createValidResult(),
        classification,
        ...(classification === NotificationFailureClassification.RATE_LIMITED
          ? { retryAfterMs: 5_000 }
          : {}),
      }),
    ).toThrow('Accepted notification provider results must be SUCCESS');
  });

  it('requires retryAfterMs for RATE_LIMITED', () => {
    expect(() =>
      assertNotificationProviderResult({
        accepted: false,
        provider: 'development-email',
        channel: 'email',
        notificationId: 'notification-contract-003',
        classification: NotificationFailureClassification.RATE_LIMITED,
        errorMessage: 'Rate limited',
      }),
    ).toThrow('RATE_LIMITED');
  });

  it('accepts RATE_LIMITED with a non-negative retryAfterMs', () => {
    expect(() =>
      assertNotificationProviderResult({
        ...createRejectedResult(NotificationFailureClassification.RATE_LIMITED),
        retryAfterMs: 0,
      }),
    ).not.toThrow();
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, '5000'])(
    'rejects invalid retryAfterMs value %s',
    (retryAfterMs) => {
      expect(() =>
        assertNotificationProviderResult({
          ...createRejectedResult(
            NotificationFailureClassification.RATE_LIMITED,
          ),
          retryAfterMs,
        }),
      ).toThrow('retryAfterMs must be a finite non-negative number');
    },
  );

  it('rejects an unsupported classification', () => {
    expect(() =>
      assertNotificationProviderResult({
        ...createValidResult(),
        classification: 'UNKNOWN',
      }),
    ).toThrow('unsupported failure classification');
  });

  it.each([
    ['provider', ''],
    ['channel', ''],
    ['notificationId', ''],
    ['messageId', ''],
    ['errorCode', ''],
    ['errorMessage', ''],
  ])('rejects an empty %s value', (field, value) => {
    expect(() =>
      assertNotificationProviderResult({
        ...createValidResult(),
        [field]: value,
      }),
    ).toThrow();
  });

  it('rejects a non-object result', () => {
    expect(() => assertNotificationProviderResult(null)).toThrow(
      'non-object result',
    );
  });

  it('rejects a non-boolean accepted value', () => {
    expect(() =>
      assertNotificationProviderResult({
        ...createValidResult(),
        accepted: 'true',
      }),
    ).toThrow('accepted must be a boolean');
  });

  it('rejects a provider result with an empty channel', () => {
    expect(() =>
      assertNotificationProviderResult({
        ...createValidResult(),
        channel: '',
      }),
    ).toThrow('channel must be a non-empty string');
  });
});
