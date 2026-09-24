import { describe, expect, it } from 'vitest';

import { getCourseOutboxRetryPolicy } from './course-outbox-retry.policy.js';

describe('Course Outbox retry policy', () => {
  it('defines a bounded retry policy', () => {
    const policy = getCourseOutboxRetryPolicy();

    expect(policy.maxAttempts).toBe(3);

    expect(policy.backoffType).toBe('exponential');

    expect(policy.initialDelayMs).toBe(1_000);

    expect(policy.maxDelayMs).toBe(60_000);
  });

  it('returns the same immutable policy contract', () => {
    const first = getCourseOutboxRetryPolicy();

    const second = getCourseOutboxRetryPolicy();

    expect(first).toBe(second);
  });

  it('does not use an unbounded retry count', () => {
    const policy = getCourseOutboxRetryPolicy();

    expect(Number.isFinite(policy.maxAttempts)).toBe(true);

    expect(policy.maxAttempts).toBeGreaterThan(0);
  });
});
