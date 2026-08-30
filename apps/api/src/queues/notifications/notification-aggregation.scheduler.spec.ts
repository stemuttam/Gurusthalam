import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  NotificationAggregationQueueIntegrationService,
} from './notification-aggregation.queue.integration.service.js';

import {
  NotificationAggregationSchedulerService,
} from './notification-aggregation.scheduler.js';

import type {
  NotificationAggregationQueueIntegrationResult,
} from './notification-aggregation.queue.integration.service.js';

describe(
  'NotificationAggregationSchedulerService',
  () => {
    const DEFAULT_INTERVAL_MS =
      5_000;

    afterEach(
      () => {
        vi.useRealTimers();

        delete process.env
          .NOTIFICATION_AGGREGATION_POLL_INTERVAL_MS;
      },
    );

    function createIntegrationMock():
      NotificationAggregationQueueIntegrationService {
      return {
        flushExpired:
          vi.fn(),
      } as unknown as NotificationAggregationQueueIntegrationService;
    }

    async function flushMicrotasks(): Promise<void> {
      await Promise.resolve();
      await Promise.resolve();
    }

    it(
      'runs one immediate poll when started',
      async () => {
        const integration =
          createIntegrationMock();

        const result:
          NotificationAggregationQueueIntegrationResult[] =
          [
            {
              aggregationId:
                'aggregation-001',

              notificationId:
                'notification-001',

              queue:
                'notifications',

              jobId:
                'job-001',

              outboxEventId:
                'outbox-001',

              itemCount:
                2,

              status:
                'FLUSHED',
            },
          ];

        vi.mocked(
          integration.flushExpired,
        ).mockResolvedValue(
          result,
        );

        const scheduler =
          new NotificationAggregationSchedulerService(
            integration,
          );

        scheduler.start();

        await flushMicrotasks();

        expect(
          integration.flushExpired,
        ).toHaveBeenCalledTimes(
          1,
        );

        await scheduler.stop();
      },
    );

    it(
      'uses the configured polling interval',
      async () => {
        process.env
          .NOTIFICATION_AGGREGATION_POLL_INTERVAL_MS =
          '1000';

        vi.useFakeTimers();

        const integration =
          createIntegrationMock();

        vi.mocked(
          integration.flushExpired,
        ).mockResolvedValue(
          [],
        );

        const scheduler =
          new NotificationAggregationSchedulerService(
            integration,
          );

        scheduler.start();

        /*
         * The scheduler performs its initial poll asynchronously.
         * Flush promises without advancing the fake clock.
         */
        await flushMicrotasks();

        expect(
          integration.flushExpired,
        ).toHaveBeenCalledTimes(
          1,
        );

        /*
         * The first interval has not elapsed yet.
         */
        await vi.advanceTimersByTimeAsync(
          999,
        );

        expect(
          integration.flushExpired,
        ).toHaveBeenCalledTimes(
          1,
        );

        /*
         * Exactly 1000 ms have now elapsed.
         */
        await vi.advanceTimersByTimeAsync(
          1,
        );

        await flushMicrotasks();

        expect(
          integration.flushExpired,
        ).toHaveBeenCalledTimes(
          2,
        );

        await scheduler.stop();
      },
    );

    it(
      'does not start more than one scheduler timer',
      async () => {
        process.env
          .NOTIFICATION_AGGREGATION_POLL_INTERVAL_MS =
          '1000';

        vi.useFakeTimers();

        const integration =
          createIntegrationMock();

        vi.mocked(
          integration.flushExpired,
        ).mockResolvedValue(
          [],
        );

        const scheduler =
          new NotificationAggregationSchedulerService(
            integration,
          );

        scheduler.start();
        scheduler.start();
        scheduler.start();

        await flushMicrotasks();

        expect(
          integration.flushExpired,
        ).toHaveBeenCalledTimes(
          1,
        );

        await vi.advanceTimersByTimeAsync(
          1000,
        );

        await flushMicrotasks();

        expect(
          integration.flushExpired,
        ).toHaveBeenCalledTimes(
          2,
        );

        await vi.advanceTimersByTimeAsync(
          1000,
        );

        await flushMicrotasks();

        expect(
          integration.flushExpired,
        ).toHaveBeenCalledTimes(
          3,
        );

        await scheduler.stop();
      },
    );

    it(
      'delegates runOnce to the aggregation integration service',
      async () => {
        const integration =
          createIntegrationMock();

        const now =
          new Date(
            '2026-08-30T08:00:00.000Z',
          );

        const result:
          NotificationAggregationQueueIntegrationResult[] =
          [
            {
              aggregationId:
                'aggregation-002',

              notificationId:
                'notification-002',

              queue:
                'notifications',

              jobId:
                'job-002',

              outboxEventId:
                'outbox-002',

              itemCount:
                3,

              status:
                'FLUSHED',
            },
          ];

        vi.mocked(
          integration.flushExpired,
        ).mockResolvedValue(
          result,
        );

        const scheduler =
          new NotificationAggregationSchedulerService(
            integration,
          );

        await expect(
          scheduler.runOnce(
            now,
          ),
        ).resolves.toEqual(
          result,
        );

        expect(
          integration.flushExpired,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          integration.flushExpired,
        ).toHaveBeenCalledWith(
          now,
        );
      },
    );

    it(
      'continues scheduling when a poll fails',
      async () => {
        process.env
          .NOTIFICATION_AGGREGATION_POLL_INTERVAL_MS =
          '1000';

        vi.useFakeTimers();

        const integration =
          createIntegrationMock();

        vi.mocked(
          integration.flushExpired,
        )
          .mockRejectedValueOnce(
            new Error(
              'temporary database failure',
            ),
          )
          .mockResolvedValue(
            [],
          );

        const scheduler =
          new NotificationAggregationSchedulerService(
            integration,
          );

        scheduler.start();

        await flushMicrotasks();

        expect(
          integration.flushExpired,
        ).toHaveBeenCalledTimes(
          1,
        );

        /*
         * A failed poll must not terminate the scheduler.
         */
        await vi.advanceTimersByTimeAsync(
          1000,
        );

        await flushMicrotasks();

        expect(
          integration.flushExpired,
        ).toHaveBeenCalledTimes(
          2,
        );

        await scheduler.stop();
      },
    );

    it(
      'does not overlap polling cycles',
      async () => {
        process.env
          .NOTIFICATION_AGGREGATION_POLL_INTERVAL_MS =
          '1000';

        vi.useFakeTimers();

        const integration =
          createIntegrationMock();

        /*
         * flushExpired() must preserve its real return type.
         *
         * The resolver intentionally accepts no argument because
         * this test only needs to release the pending operation.
         */
        let resolveFirst:
          (() => void) | undefined;

        const firstPoll =
          new Promise<
            NotificationAggregationQueueIntegrationResult[]
          >(
            (
              resolve,
            ) => {
              resolveFirst =
                () => {
                  resolve(
                    [],
                  );
                };
            },
          );

        vi.mocked(
          integration.flushExpired,
        )
          .mockReturnValueOnce(
            firstPoll,
          )
          .mockResolvedValue(
            [],
          );

        const scheduler =
          new NotificationAggregationSchedulerService(
            integration,
          );

        scheduler.start();

        await flushMicrotasks();

        expect(
          integration.flushExpired,
        ).toHaveBeenCalledTimes(
          1,
        );

        /*
         * Three interval periods pass while the first poll is
         * still running.
         *
         * No overlapping execution is permitted.
         */
        await vi.advanceTimersByTimeAsync(
          3000,
        );

        expect(
          integration.flushExpired,
        ).toHaveBeenCalledTimes(
          1,
        );

        /*
         * Complete the first poll.
         */
        resolveFirst?.();

        await flushMicrotasks();

        /*
         * Resolving the first poll does NOT itself trigger an
         * immediate second poll. The next poll belongs to the
         * scheduler's next interval.
         */
        expect(
          integration.flushExpired,
        ).toHaveBeenCalledTimes(
          1,
        );

        /*
         * Advance to the next interval boundary.
         */
        await vi.advanceTimersByTimeAsync(
          1000,
        );

        await flushMicrotasks();

        expect(
          integration.flushExpired,
        ).toHaveBeenCalledTimes(
          2,
        );

        await scheduler.stop();
      },
    );

    it(
      'stops polling after stop',
      async () => {
        process.env
          .NOTIFICATION_AGGREGATION_POLL_INTERVAL_MS =
          '1000';

        vi.useFakeTimers();

        const integration =
          createIntegrationMock();

        vi.mocked(
          integration.flushExpired,
        ).mockResolvedValue(
          [],
        );

        const scheduler =
          new NotificationAggregationSchedulerService(
            integration,
          );

        scheduler.start();

        await flushMicrotasks();

        expect(
          integration.flushExpired,
        ).toHaveBeenCalledTimes(
          1,
        );

        await scheduler.stop();

        await vi.advanceTimersByTimeAsync(
          5000,
        );

        await flushMicrotasks();

        expect(
          integration.flushExpired,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    it(
      'rejects an invalid configured polling interval',
      () => {
        process.env
          .NOTIFICATION_AGGREGATION_POLL_INTERVAL_MS =
          '500';

        const integration =
          createIntegrationMock();

        expect(
          () =>
            new NotificationAggregationSchedulerService(
              integration,
            ),
        ).toThrow(
          'NOTIFICATION_AGGREGATION_POLL_INTERVAL_MS must be an integer greater than or equal to 1000.',
        );
      },
    );

    it(
      'uses the default polling interval when no environment value is configured',
      async () => {
        vi.useFakeTimers();

        const integration =
          createIntegrationMock();

        vi.mocked(
          integration.flushExpired,
        ).mockResolvedValue(
          [],
        );

        const scheduler =
          new NotificationAggregationSchedulerService(
            integration,
          );

        scheduler.start();

        await flushMicrotasks();

        expect(
          integration.flushExpired,
        ).toHaveBeenCalledTimes(
          1,
        );

        /*
         * Default interval is 5000 ms.
         */
        await vi.advanceTimersByTimeAsync(
          DEFAULT_INTERVAL_MS - 1,
        );

        await flushMicrotasks();

        expect(
          integration.flushExpired,
        ).toHaveBeenCalledTimes(
          1,
        );

        await vi.advanceTimersByTimeAsync(
          1,
        );

        await flushMicrotasks();

        expect(
          integration.flushExpired,
        ).toHaveBeenCalledTimes(
          2,
        );

        await scheduler.stop();
      },
    );
  },
);