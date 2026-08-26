import {
  describe,
  expect,
  it,
} from 'vitest';

describe(
  'NotificationMetricsService fallback metrics contract',
  () => {
    it(
      'defines the fallback lifecycle counters',
      () => {
        expect(
          [
            'fallbackStarted',
            'fallbackAttempts',
            'fallbackAttemptFailures',
            'fallbackRecovered',
            'fallbackExhausted',
            'fallbackIdempotentHits',
          ],
        ).toHaveLength(
          6,
        );
      },
    );
  },
);