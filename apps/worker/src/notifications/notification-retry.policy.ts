import {
  NotificationFailureClassification,
  type NotificationFailureClassification as NotificationFailureClassificationType,
} from '../providers/notification/notification-provider-result.types.js';

export interface NotificationRetryPolicy {
  readonly maxAttempts:
    number;

  readonly backoffType:
    | 'fixed'
    | 'exponential';

  readonly initialDelayMs:
    number;

  readonly maxDelayMs:
    number;
}

export interface NotificationRetryDecision {
  readonly shouldRetry:
    boolean;

  readonly terminal:
    boolean;

  readonly delayMs:
    number;
}

export interface NotificationRetryErrorMetadata {
  readonly classification?:
    NotificationFailureClassificationType;

  readonly retryAfterMs?:
    number;
}

/*
 * The BullMQ job uses this exact custom backoff type.
 */
export const NOTIFICATION_RETRY_BACKOFF_TYPE =
  'notification-policy' as const;

const DEFAULT_NOTIFICATION_RETRY_POLICY:
  NotificationRetryPolicy = {
    maxAttempts:
      3,

    backoffType:
      'exponential',

    initialDelayMs:
      1_000,

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
  attempt:
    number,

  policy:
    NotificationRetryPolicy,
): number {
  if (
    attempt <=
    1
  ) {
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

export function getRateLimitRetryDelay(
  retryAfterMs:
    number | undefined,

  policy:
    NotificationRetryPolicy,
): number {
  if (
    !Number.isFinite(
      retryAfterMs,
    ) ||
    retryAfterMs ===
      undefined
  ) {
    return policy.initialDelayMs;
  }

  return Math.min(
    policy.maxDelayMs,

    Math.max(
      0,
      Math.floor(
        retryAfterMs,
      ),
    ),
  );
}

export function getProviderAwareRetryDelay(
  attempt:
    number,

  classification:
    NotificationFailureClassificationType,

  retryAfterMs:
    number | undefined,

  policy:
    NotificationRetryPolicy,
): number {
  if (
    classification ===
    NotificationFailureClassification.RATE_LIMITED
  ) {
    return getRateLimitRetryDelay(
      retryAfterMs,

      policy,
    );
  }

  return getNotificationRetryDelay(
    attempt,

    policy,
  );
}

export function decideNotificationRetry(
  classification:
    NotificationFailureClassificationType,

  attempt:
    number,

  policy:
    NotificationRetryPolicy,

  retryAfterMs:
    number | undefined = undefined,
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
      getProviderAwareRetryDelay(
        attempt,

        classification,

        retryAfterMs,

        policy,
      ),
  };
}

export function getNotificationBackoffDelay(
  attemptsMade:
    number,

  error:
    unknown,

  policy:
    NotificationRetryPolicy =
      getNotificationRetryPolicy(),
): number {
  /*
   * BullMQ supplies attemptsMade as the number of attempts
   * already performed before the next retry.
   *
   * Our retry policy calculates its delay using the upcoming
   * attempt number, hence +1.
   */
  const upcomingAttempt =
    Math.max(
      1,
      attemptsMade + 1,
    );

  const metadata =
    isNotificationRetryErrorMetadata(
      error,
    );

  if (
    metadata?.classification ===
    NotificationFailureClassification.RATE_LIMITED
  ) {
    return getProviderAwareRetryDelay(
      upcomingAttempt,

      NotificationFailureClassification.RATE_LIMITED,

      metadata.retryAfterMs,

      policy,
    );
  }

  return getNotificationRetryDelay(
    upcomingAttempt,

    policy,
  );
}

function isNotificationRetryErrorMetadata(
  error:
    unknown,
):
  NotificationRetryErrorMetadata |
  undefined {
  if (
    typeof error !==
      'object' ||
    error ===
      null
  ) {
    return undefined;
  }

  const candidate =
    error as {
      readonly classification?:
        unknown;

      readonly retryAfterMs?:
        unknown;
    };

  const classification =
    candidate.classification;

  const retryAfterMs =
    candidate.retryAfterMs;

  const validClassification =
    typeof classification ===
      'string' &&
    (
      classification ===
        NotificationFailureClassification.SUCCESS ||
      classification ===
        NotificationFailureClassification.RETRYABLE ||
      classification ===
        NotificationFailureClassification.RATE_LIMITED ||
      classification ===
        NotificationFailureClassification.NON_RETRYABLE ||
      classification ===
        NotificationFailureClassification.PERMANENT
    );

  if (
    !validClassification &&
    typeof retryAfterMs !==
      'number'
  ) {
    return undefined;
  }

  return {
    ...(validClassification
      ? {
          classification:
            classification as NotificationFailureClassificationType,
        }
      : {}),

    ...(typeof retryAfterMs ===
      'number'
      ? {
          retryAfterMs,
        }
      : {}),
  };
}