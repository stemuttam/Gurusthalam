import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import {
  GurusthalamLogger,
} from '@gurusthalam/logger';

import {
  NotificationMetricsService,
} from './notification-metrics.service.js';

describe(
  'NotificationMetricsService - Redis integration',
  () => {
    let metrics:
      NotificationMetricsService;

    const logger =
      {
        info:
          () => undefined,

        warn:
          () => undefined,

        error:
          () => undefined,

        debug:
          () => undefined,
      } as unknown as
        GurusthalamLogger;

    async function waitForSnapshot(
      expected:
        Partial<{
          fallbackStarted:
            number;

          fallbackAttempts:
            number;

          fallbackAttemptFailures:
            number;

          fallbackRecovered:
            number;

          fallbackExhausted:
            number;

          fallbackIdempotentHits:
            number;
        }>,
    ):
      Promise<
        Awaited<
          ReturnType<
            NotificationMetricsService['snapshot']
          >
        >
      > {
      const timeoutMs =
        3_000;

      const intervalMs =
        25;

      const startedAt =
        Date.now();

      while (
        Date.now() -
          startedAt <
        timeoutMs
      ) {
        const snapshot =
          await metrics.snapshot();

        const matches =
          Object.entries(
            expected,
          ).every(
            ([
              key,
              value,
            ]) =>
              snapshot[
                key as keyof typeof snapshot
              ] ===
              value,
          );

        if (
          matches
        ) {
          return snapshot;
        }

        await new Promise<void>(
          (
            resolve,
          ) => {
            setTimeout(
              resolve,
              intervalMs,
            );
          },
        );
      }

      return metrics.snapshot();
    }

    beforeAll(
      async () => {
        metrics =
          new NotificationMetricsService(
            logger,
          );

        await metrics.reset();
      },
    );

    beforeEach(
      async () => {
        await metrics.reset();

        await waitForSnapshot({
          fallbackStarted:
            0,

          fallbackAttempts:
            0,

          fallbackAttemptFailures:
            0,

          fallbackRecovered:
            0,

          fallbackExhausted:
            0,

          fallbackIdempotentHits:
            0,
        });
      },
    );

    afterAll(
      async () => {
        await metrics.reset();

        await metrics.close();
      },
    );

    it(
      'persists fallback lifecycle counters into the aggregate snapshot',
      async () => {
        metrics.incrementFallbackStarted();

        metrics.incrementFallbackAttempts();

        metrics.incrementFallbackAttempts();

        metrics.incrementFallbackAttemptFailures();

        metrics.incrementFallbackRecovered();

        metrics.incrementFallbackExhausted();

        metrics.incrementFallbackIdempotentHits();

        const snapshot =
          await waitForSnapshot({
            fallbackStarted:
              1,

            fallbackAttempts:
              2,

            fallbackAttemptFailures:
              1,

            fallbackRecovered:
              1,

            fallbackExhausted:
              1,

            fallbackIdempotentHits:
              1,
          });

        expect(
          snapshot.fallbackStarted,
        ).toBe(
          1,
        );

        expect(
          snapshot.fallbackAttempts,
        ).toBe(
          2,
        );

        expect(
          snapshot.fallbackAttemptFailures,
        ).toBe(
          1,
        );

        expect(
          snapshot.fallbackRecovered,
        ).toBe(
          1,
        );

        expect(
          snapshot.fallbackExhausted,
        ).toBe(
          1,
        );

        expect(
          snapshot.fallbackIdempotentHits,
        ).toBe(
          1,
        );
      },
    );

    it(
      'preserves fallback counters across multiple lifecycle updates',
      async () => {
        metrics.incrementFallbackStarted();

        metrics.incrementFallbackStarted();

        metrics.incrementFallbackAttempts();

        metrics.incrementFallbackAttempts();

        metrics.incrementFallbackAttempts();

        metrics.incrementFallbackAttemptFailures();

        metrics.incrementFallbackAttemptFailures();

        metrics.incrementFallbackRecovered();

        const snapshot =
          await waitForSnapshot({
            fallbackStarted:
              2,

            fallbackAttempts:
              3,

            fallbackAttemptFailures:
              2,

            fallbackRecovered:
              1,
          });

        expect(
          snapshot.fallbackStarted,
        ).toBe(
          2,
        );

        expect(
          snapshot.fallbackAttempts,
        ).toBe(
          3,
        );

        expect(
          snapshot.fallbackAttemptFailures,
        ).toBe(
          2,
        );

        expect(
          snapshot.fallbackRecovered,
        ).toBe(
          1,
        );

        expect(
          snapshot.fallbackExhausted,
        ).toBe(
          0,
        );

        expect(
          snapshot.fallbackIdempotentHits,
        ).toBe(
          0,
        );
      },
    );

    it(
      'reset clears fallback counters together with notification metrics',
      async () => {
        metrics.incrementQueued();

        metrics.incrementFallbackStarted();

        metrics.incrementFallbackAttempts();

        metrics.incrementFallbackAttemptFailures();

        metrics.incrementFallbackRecovered();

        metrics.incrementFallbackExhausted();

        metrics.incrementFallbackIdempotentHits();

        const beforeReset =
          await waitForSnapshot({
            fallbackStarted:
              1,

            fallbackAttempts:
              1,

            fallbackAttemptFailures:
              1,

            fallbackRecovered:
              1,

            fallbackExhausted:
              1,

            fallbackIdempotentHits:
              1,
          });

        expect(
          beforeReset.queued,
        ).toBe(
          1,
        );

        await metrics.reset();

        const afterReset =
          await waitForSnapshot({
            fallbackStarted:
              0,

            fallbackAttempts:
              0,

            fallbackAttemptFailures:
              0,

            fallbackRecovered:
              0,

            fallbackExhausted:
              0,

            fallbackIdempotentHits:
              0,
          });

        expect(
          afterReset.queued,
        ).toBe(
          0,
        );

        expect(
          afterReset.fallbackStarted,
        ).toBe(
          0,
        );

        expect(
          afterReset.fallbackAttempts,
        ).toBe(
          0,
        );

        expect(
          afterReset.fallbackAttemptFailures,
        ).toBe(
          0,
        );

        expect(
          afterReset.fallbackRecovered,
        ).toBe(
          0,
        );

        expect(
          afterReset.fallbackExhausted,
        ).toBe(
          0,
        );

        expect(
          afterReset.fallbackIdempotentHits,
        ).toBe(
          0,
        );
      },
    );

    it(
      'does not mix provider metrics with aggregate fallback counters',
      async () => {
        metrics.incrementFallbackStarted();

        metrics.incrementFallbackAttempts();

        metrics.incrementFallbackRecovered();

        metrics.incrementProviderSent(
          'development-push',
        );

        const snapshot =
          await waitForSnapshot({
            fallbackStarted:
              1,

            fallbackAttempts:
              1,

            fallbackRecovered:
              1,
          });

        const providerSnapshot =
          await metrics.providerSnapshot(
            'development-push',
          );

        expect(
          snapshot.fallbackStarted,
        ).toBe(
          1,
        );

        expect(
          snapshot.fallbackAttempts,
        ).toBe(
          1,
        );

        expect(
          snapshot.fallbackRecovered,
        ).toBe(
          1,
        );

        expect(
          providerSnapshot.sent,
        ).toBe(
          1,
        );

        expect(
          providerSnapshot.failed,
        ).toBe(
          0,
        );
      },
    );
  },
);