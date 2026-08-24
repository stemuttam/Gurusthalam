import {
  NotificationFailureClassification,
  type NotificationProviderResult,
} from './notification-provider-result.types.js';

import {
  NotificationProviderError,
} from './notification-provider.error.js';

const VALID_CLASSIFICATIONS:
  ReadonlySet<
    NotificationFailureClassification
  > =
  new Set([
    NotificationFailureClassification.SUCCESS,
    NotificationFailureClassification.RETRYABLE,
    NotificationFailureClassification.RATE_LIMITED,
    NotificationFailureClassification.NON_RETRYABLE,
    NotificationFailureClassification.PERMANENT,
  ]);

function isRecord(
  value:
    unknown,
): value is Record<string, unknown> {
  return (
    typeof value ===
      'object' &&
    value !==
      null &&
    !Array.isArray(
      value,
    )
  );
}

function isNonEmptyString(
  value:
    unknown,
): value is string {
  return (
    typeof value ===
      'string' &&
    value.trim()
      .length >
      0
  );
}

export function assertNotificationProviderResult(
  result:
    unknown,
): asserts result is NotificationProviderResult {
  if (
    !isRecord(
      result,
    )
  ) {
    throw new NotificationProviderError(
      'Notification provider returned a non-object result.',
    );
  }

  if (
    typeof result.accepted !==
    'boolean'
  ) {
    throw new NotificationProviderError(
      'Notification provider result.accepted must be a boolean.',
    );
  }

  if (
    !isNonEmptyString(
      result.provider,
    )
  ) {
    throw new NotificationProviderError(
      'Notification provider result.provider must be a non-empty string.',
    );
  }

  if (
    !isNonEmptyString(
      result.channel,
    )
  ) {
    throw new NotificationProviderError(
      'Notification provider result.channel must be a non-empty string.',
    );
  }

  if (
    !isNonEmptyString(
      result.notificationId,
    )
  ) {
    throw new NotificationProviderError(
      'Notification provider result.notificationId must be a non-empty string.',
    );
  }

  if (
    !VALID_CLASSIFICATIONS.has(
      result.classification as NotificationFailureClassification,
    )
  ) {
    throw new NotificationProviderError(
      `Notification provider returned an unsupported failure classification: ${String(result.classification)}`,
    );
  }

  if (
    result.messageId !==
      undefined &&
    !isNonEmptyString(
      result.messageId,
    )
  ) {
    throw new NotificationProviderError(
      'Notification provider result.messageId must be a non-empty string when provided.',
    );
  }

  if (
    result.errorCode !==
      undefined &&
    !isNonEmptyString(
      result.errorCode,
    )
  ) {
    throw new NotificationProviderError(
      'Notification provider result.errorCode must be a non-empty string when provided.',
    );
  }

  if (
    result.errorMessage !==
      undefined &&
    !isNonEmptyString(
      result.errorMessage,
    )
  ) {
    throw new NotificationProviderError(
      'Notification provider result.errorMessage must be a non-empty string when provided.',
    );
  }

  if (
    result.retryAfterMs !==
      undefined &&
    (
      typeof result.retryAfterMs !==
        'number' ||
      !Number.isFinite(
        result.retryAfterMs,
      ) ||
      result.retryAfterMs <
        0
    )
  ) {
    throw new NotificationProviderError(
      'Notification provider result.retryAfterMs must be a finite non-negative number when provided.',
    );
  }

  if (
    result.classification ===
      NotificationFailureClassification.RATE_LIMITED &&
    (
      result.retryAfterMs ===
        undefined ||
      result.retryAfterMs <
        0
    )
  ) {
    throw new NotificationProviderError(
      'RATE_LIMITED provider results must include a non-negative retryAfterMs value.',
    );
  }

  if (
    result.accepted &&
    (
      result.classification !==
        NotificationFailureClassification.SUCCESS ||
      !isNonEmptyString(
        result.messageId,
      )
    )
  ) {
    throw new NotificationProviderError(
      'Accepted notification provider results must be SUCCESS and must include a messageId.',
    );
  }

  if (
    !result.accepted &&
    result.classification ===
      NotificationFailureClassification.SUCCESS
  ) {
    throw new NotificationProviderError(
      'A SUCCESS notification provider result must have accepted=true.',
    );
  }
}