import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import {
  NotificationAggregationQueueIntegrationService,
} from './notification-aggregation.queue.integration.service.js';

const DEFAULT_POLL_INTERVAL_MS =
  5_000;

const MIN_POLL_INTERVAL_MS =
  1_000;

function resolvePollInterval(): number {
  const rawValue =
    process.env.NOTIFICATION_AGGREGATION_POLL_INTERVAL_MS;

  if (
    rawValue === undefined ||
    rawValue.trim().length === 0
  ) {
    return DEFAULT_POLL_INTERVAL_MS;
  }

  const parsed =
    Number(
      rawValue,
    );

  if (
    !Number.isInteger(parsed) ||
    parsed < MIN_POLL_INTERVAL_MS
  ) {
    throw new Error(
      `NOTIFICATION_AGGREGATION_POLL_INTERVAL_MS must be an integer greater than or equal to ${MIN_POLL_INTERVAL_MS}.`,
    );
  }

  return parsed;
}

/**
 * Periodically triggers processing of expired notification
 * aggregations.
 *
 * This scheduler is intentionally thin.
 *
 * It does NOT:
 *
 * - query Prisma directly;
 * - manipulate aggregation status directly;
 * - enqueue BullMQ jobs directly;
 * - resolve notification source events;
 * - construct NotificationJobData.
 *
 * All of those responsibilities remain behind the existing
 * application/integration boundaries.
 *
 * Concurrency safety is provided by the atomic
 *
 *   OPEN -> FLUSHING
 *
 * database claim performed by
 * NotificationAggregationRepository.claimExpiredForFlushing().
 */
@Injectable()
export class NotificationAggregationSchedulerService
  implements OnModuleInit, OnModuleDestroy {
  private readonly logger =
    new Logger(
      NotificationAggregationSchedulerService.name,
    );

  private readonly pollIntervalMs:
    number;

  private timer:
    NodeJS.Timeout | undefined;

  private running =
    false;

  private polling =
    false;

  constructor(
    private readonly aggregationIntegration:
      NotificationAggregationQueueIntegrationService,
  ) {
    this.pollIntervalMs =
      resolvePollInterval();
  }

  /**
   * Starts the scheduler exactly once.
   *
   * The first poll happens immediately so the application does
   * not have to wait for the first interval after startup.
   */
  onModuleInit(): void {
    this.start();
  }

  /**
   * Stops the scheduler and waits for an in-flight poll to finish.
   */
  async onModuleDestroy(): Promise<void> {
    await this.stop();
  }

  /**
   * Starts the scheduler.
   *
   * This method is public to make lifecycle behavior explicit and
   * straightforward to unit test.
   */
  start(): void {
    if (
      this.running
    ) {
      return;
    }

    this.running =
      true;

    /*
     * Trigger an immediate discovery pass.
     *
     * Do not await it here because Nest module initialization
     * should not be blocked by notification aggregation work.
     */
    void this.poll();

    this.timer =
      setInterval(
        () => {
          void this.poll();
        },
        this.pollIntervalMs,
      );

    this.logger.log(
      `Notification aggregation scheduler started with ${this.pollIntervalMs}ms interval.`,
    );
  }

  /**
   * Stops the scheduler.
   *
   * The current poll is allowed to finish before shutdown
   * completes so that we do not abandon an in-flight database
   * operation or queue submission.
   */
  async stop(): Promise<void> {
    if (
      !this.running
    ) {
      return;
    }

    this.running =
      false;

    if (
      this.timer !==
      undefined
    ) {
      clearInterval(
        this.timer,
      );

      this.timer =
        undefined;
    }

    /*
     * Wait for an active polling cycle to complete.
     */
    while (
      this.polling
    ) {
      await new Promise<void>(
        (
          resolve,
        ) => {
          setTimeout(
            resolve,
            25,
          );
        },
      );
    }

    this.logger.log(
      'Notification aggregation scheduler stopped.',
    );
  }

  /**
   * Executes exactly one discovery/flush pass.
   *
   * This method is public so operational/runtime tests can invoke
   * a single deterministic scheduler cycle without waiting for
   * the configured timer.
   */
  async runOnce(
    now:
      Date = new Date(),
  ): Promise<
    Awaited<
      ReturnType<
        NotificationAggregationQueueIntegrationService['flushExpired']
      >
    >
  > {
    return this.aggregationIntegration.flushExpired(
      now,
    );
  }

  /**
   * Performs one scheduled polling cycle.
   *
   * Overlapping cycles are intentionally prevented inside one
   * scheduler instance.
   *
   * Multiple application instances are still safe because the
   * aggregation repository performs the authoritative atomic
   * OPEN -> FLUSHING claim.
   */
  private async poll(): Promise<void> {
    if (
      !this.running ||
      this.polling
    ) {
      return;
    }

    this.polling =
      true;

    try {
      await this.runOnce();
    } catch (
      error: unknown
    ) {
      /*
       * A scheduler failure must never become an unhandled
       * promise rejection and must not terminate the API process.
       *
       * The next scheduled cycle will retry discovery.
       */
      const message =
        error instanceof Error
          ? error.message
          : String(
              error,
            );

      this.logger.error(
        `Notification aggregation scheduler poll failed: ${message}`,
        error instanceof Error
          ? error.stack
          : undefined,
      );
    } finally {
      this.polling =
        false;
    }
  }
}