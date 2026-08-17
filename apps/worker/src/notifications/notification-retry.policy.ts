import {
  NotificationFailureClassification,
  type NotificationFailureClassification as NotificationFailureClassificationType,
} from '../providers/notification/notification-provider-result.types.js';

export interface NotificationRetryPolicy {
  readonly maxAttempts: number;
  readonly backoffType:
    | 'fixed'
    | 'exponential';
  readonly initialDelayMs: number;
  readonly maxDelayMs: number;
}

export interface NotificationRetryDecision {
  readonly shouldRetry: boolean;
  readonly terminal: boolean;
  readonly delayMs: number;
}

const DEFAULT_NOTIFICATION_RETRY_POLICY:
  NotificationRetryPolicy = {
    maxAttempts: 3,

    backoffType:
      'exponential',

    initialDelayMs:
      1000,

    maxDelayMs:
      60_000,
  };

const RETRYABLE_CLASSIFICATIONS:
  ReadonlySet<
    NotificationFailureClassificationType
  > =
  new Set([
    NotificationFailureClassification.RETRYABLE,
    NotificationFailureClassification.RATE_LIMITED,
  ]);

const TERMINAL_CLASSIFICATIONS:
  ReadonlySet<
    NotificationFailureClassificationType
  > =
  new Set([
    NotificationFailureClassification.NON_RETRYABLE,
    NotificationFailureClassification.PERMANENT,
  ]);

export function getNotificationRetryPolicy():
  NotificationRetryPolicy {
  return DEFAULT_NOTIFICATION_RETRY_POLICY;
}

export function isRetryableNotificationClassification(
  classification:
    NotificationFailureClassificationType,
): boolean {
  return RETRYABLE_CLASSIFICATIONS.has(
    classification,
  );
}

export function isTerminalNotificationClassification(
  classification:
    NotificationFailureClassificationType,
): boolean {
  return TERMINAL_CLASSIFICATIONS.has(
    classification,
  );
}

export function getNotificationRetryDelay(
  attempt: number,
  policy: NotificationRetryPolicy,
): number {
  if (attempt <= 1) {
    return 0;
  }

  if (
    policy.backoffType ===
    'fixed'
  ) {
    return policy.initialDelayMs;
  }

  const exponentialDelay =
    policy.initialDelayMs *
    Math.pow(
      2,
      Math.max(
        0,
        attempt - 2,
      ),
    );

  return Math.min(
    policy.maxDelayMs,
    exponentialDelay,
  );
}

export function decideNotificationRetry(
  classification:
    NotificationFailureClassificationType,

  attempt: number,

  policy: NotificationRetryPolicy,
): NotificationRetryDecision {
  if (
    classification ===
    NotificationFailureClassification.SUCCESS
  ) {
    return {
      shouldRetry:
        false,

      terminal:
        false,

      delayMs:
        0,
    };
  }

  if (
    isTerminalNotificationClassification(
      classification,
    )
  ) {
    return {
      shouldRetry:
        false,

      terminal:
        true,

      delayMs:
        0,
    };
  }

  if (
    !isRetryableNotificationClassification(
      classification,
    )
  ) {
    return {
      shouldRetry:
        false,

      terminal:
        true,

      delayMs:
        0,
    };
  }

  if (
    attempt >=
    policy.maxAttempts
  ) {
    return {
      shouldRetry:
        false,

      terminal:
        true,

      delayMs:
        0,
    };
  }

  return {
    shouldRetry:
      true,

    terminal:
      false,

    delayMs:
      getNotificationRetryDelay(
        attempt,
        policy,
      ),
  };
}