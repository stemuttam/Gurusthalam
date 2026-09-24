/**
 * Course Outbox transport retry policy.
 *
 * This policy controls BullMQ execution retries for Course event
 * consumers.
 *
 * It is intentionally independent from the PostgreSQL Outbox retry
 * lifecycle.
 *
 * PostgreSQL Outbox retry:
 *
 *   PENDING -> PROCESSING -> PENDING
 *                         -> DEAD_LETTER
 *
 * BullMQ transport retry:
 *
 *   job attempt 1 -> job attempt 2 -> job attempt 3
 *
 * The PostgreSQL Outbox remains the durable source of truth for
 * whether the event itself has been successfully published.
 */

export interface CourseOutboxRetryPolicy {
  readonly maxAttempts: number;

  readonly backoffType: 'fixed' | 'exponential';

  readonly initialDelayMs: number;

  readonly maxDelayMs: number;
}

/**
 * D4 Course transport retry policy.
 *
 * Three total BullMQ attempts:
 *
 *   attempt 1
 *   attempt 2
 *   attempt 3
 *
 * Delays:
 *
 *   retry 1 -> 1 second
 *   retry 2 -> 2 seconds
 *
 * The maximum delay is retained as part of the policy contract so
 * future policy consumers cannot accidentally introduce unbounded
 * backoff.
 */
const DEFAULT_COURSE_OUTBOX_RETRY_POLICY: CourseOutboxRetryPolicy = {
  maxAttempts: 3,

  backoffType: 'exponential',

  initialDelayMs: 1_000,

  maxDelayMs: 60_000,
};

export function getCourseOutboxRetryPolicy(): CourseOutboxRetryPolicy {
  return DEFAULT_COURSE_OUTBOX_RETRY_POLICY;
}
