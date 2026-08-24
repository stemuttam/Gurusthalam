import {
  getNotificationBackoffDelay,
  NOTIFICATION_RETRY_BACKOFF_TYPE,
} from '../notifications/notification-retry.policy.js';

export const WORKER_CONCURRENCY =
  5;

const notificationBackoffStrategy = (
  attemptsMade:
    number,

  type:
    string | undefined,

  error:
    Error | undefined,

  job:
    unknown,
): number => {
  /*
   * BullMQ supplies a MinimalJob-compatible value here.
   *
   * The notification retry strategy does not need the job
   * instance itself, so keep the parameter intentionally opaque.
   */
  void job;

  if (
    type !==
    NOTIFICATION_RETRY_BACKOFF_TYPE
  ) {
    throw new Error(
      `Unsupported BullMQ backoff type: ${String(type)}`,
    );
  }

  return getNotificationBackoffDelay(
    attemptsMade,

    error,
  );
};

export const WORKER_OPTIONS = {
  autorun:
    true,

  concurrency:
    WORKER_CONCURRENCY,

  limiter: {
    max:
      100,

    duration:
      1_000,
  },

  /*
   * Explicit stalled-job recovery configuration.
   */
  stalledInterval:
    5_000,

  maxStalledCount:
    3,

  lockDuration:
    30_000,

  /*
   * Provider-aware notification retry support.
   *
   * Only notification jobs using the
   * `notification-policy` backoff type invoke this strategy.
   */
  settings: {
    backoffStrategy:
      notificationBackoffStrategy,
  },
} as const;