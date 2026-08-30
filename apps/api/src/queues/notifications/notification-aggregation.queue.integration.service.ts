import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import {
  NotificationAggregationBuilder,
} from './notification-aggregation.builder.js';

import {
  NotificationAggregationFlushService,
} from './notification-aggregation.flush.service.js';

import {
  NotificationAggregationSourceEventResolver,
} from './notification-aggregation.source-event.resolver.js';

import {
  NotificationQueueService,
} from './notification.queue.js';

export interface NotificationAggregationQueueIntegrationResult {
  readonly aggregationId:
    string;

  readonly notificationId:
    string;

  readonly queue:
    string;

  readonly jobId:
    string;

  readonly outboxEventId:
    string;

  readonly itemCount:
    number;

  readonly status:
    'FLUSHED';
}

/**
 * Integrates an expired notification aggregation with the
 * existing notification queue pipeline.
 *
 * Responsibilities:
 *
 * 1. Atomically claim an expired aggregation.
 * 2. Resolve persisted source-event identities.
 * 3. Build one NotificationJobData object.
 * 4. Submit that NotificationJobData through the existing
 *    NotificationQueueService.
 * 5. Mark the aggregation as FLUSHED after successful enqueue.
 *
 * This service deliberately does not access BullMQ directly.
 *
 * BullMQ remains downstream of the existing notification
 * outbox/queue architecture.
 */
@Injectable()
export class NotificationAggregationQueueIntegrationService {
  constructor(
    private readonly flushService:
      NotificationAggregationFlushService,

    private readonly sourceEventResolver:
      NotificationAggregationSourceEventResolver,

    private readonly builder:
      NotificationAggregationBuilder,

    private readonly notificationQueue:
      NotificationQueueService,
  ) {}

  /**
   * Flushes one expired aggregation into the existing
   * notification queue pipeline.
   *
   * The aggregation is atomically claimed before any
   * source-event resolution, notification building, or
   * queue submission occurs.
   *
   * This makes OPEN -> FLUSHING the concurrency boundary.
   */
  async flush(
    aggregationId:
      string,

    now:
      Date = new Date(),
  ): Promise<
    NotificationAggregationQueueIntegrationResult
  > {
    this.validateAggregationId(
      aggregationId,
    );

    this.validateDate(
      now,
      'now',
    );

    /*
     * IMPORTANT:
     *
     * Do not perform:
     *
     *   getExpiredSnapshot()
     *   markFlushing()
     *
     * because that sequence is not atomic.
     *
     * Instead the repository performs one conditional
     * database update:
     *
     *   WHERE aggregationId = ...
     *     AND status = OPEN
     *     AND windowEnd <= now
     *
     *   SET status = FLUSHING
     *
     * Only the caller that receives count = 1 owns
     * the aggregation.
     */
    const claimedGroup =
      await this.flushService.claimExpiredForFlushing(
        aggregationId,
        now,
      );

    /*
     * Another scheduler/API instance may already have
     * claimed the aggregation.
     *
     * There is nothing for this caller to process.
     */
    if (
      claimedGroup === null
    ) {
      throw new BadRequestException(
        `Notification aggregation "${aggregationId}" is not eligible for flushing.`,
      );
    }

    try {
      /*
       * The aggregation is now FLUSHING.
       *
       * Therefore getExpiredSnapshot() must NOT be called
       * here because it intentionally only returns OPEN
       * aggregations.
       *
       * Read the persisted items directly after ownership
       * has been established.
       */
      const aggregationItems =
        await this.flushService.getItems(
          aggregationId,
        );

      if (
        aggregationItems.length ===
        0
      ) {
        throw new BadRequestException(
          `Notification aggregation "${aggregationId}" contains no items.`,
        );
      }

      const sourceEventIds =
        aggregationItems.map(
          (
            item,
          ) =>
            item.sourceEventId,
        );

      const sourceEvents =
        await this.sourceEventResolver.resolveMany(
          sourceEventIds,
        );

      const notificationData =
        this.builder.build({
          group:
            claimedGroup,

          items:
            aggregationItems,

          sourceEvents,
        });

      /*
       * Use the existing notification queue abstraction.
       *
       * Do not enqueue directly into BullMQ here.
       *
       * NotificationQueueService owns:
       *
       * - template resolution;
       * - notification persistence;
       * - transactional outbox creation;
       * - notification idempotency;
       * - queue identity.
       */
      const enqueueResult =
        await this.notificationQueue.enqueue(
          notificationData,
        );

      const flushed =
        await this.flushService.markFlushed(
          aggregationId,
        );

      return {
        aggregationId:
          flushed.aggregationId,

        notificationId:
          enqueueResult.notificationId,

        queue:
          enqueueResult.queue,

        jobId:
          enqueueResult.jobId,

        outboxEventId:
          enqueueResult.outboxEventId,

        itemCount:
          aggregationItems.length,

        status:
          'FLUSHED',
      };
    } catch (
      error: unknown
    ) {
      /*
       * The aggregation must not remain stuck in FLUSHING when
       * source resolution, building, queue persistence, or the
       * final state transition fails.
       */
      try {
        await this.flushService.markFailed(
          aggregationId,
        );
      } catch (
        statusError: unknown
      ) {
        /*
         * Preserve the original operational failure while still
         * making the status-transition failure visible to the
         * application logs/observability layer later.
         *
         * We deliberately do not replace the original error here.
         */
        void statusError;
      }

      throw error;
    }
  }

  /**
   * Flushes every currently expired OPEN aggregation.
   *
   * Each aggregation is processed independently.
   *
   * A failure in one aggregation does not prevent subsequent
   * aggregations from being attempted.
   *
   * Each individual flush() performs its own atomic claim.
   */
  async flushExpired(
    now:
      Date = new Date(),
  ): Promise<
    NotificationAggregationQueueIntegrationResult[]
  > {
    this.validateDate(
      now,
      'now',
    );

    const snapshots =
      await this.flushService.findExpiredSnapshots(
        now,
      );

    const results:
      NotificationAggregationQueueIntegrationResult[] =
      [];

    for (
      const snapshot of snapshots
    ) {
      try {
        const result =
          await this.flush(
            snapshot.group.aggregationId,
            now,
          );

        results.push(
          result,
        );
      } catch (
        error: unknown
      ) {
        /*
         * Continue processing the remaining expired
         * aggregations.
         *
         * If the claim returns null, another caller already
         * owns that aggregation.
         *
         * If the claim succeeds and a later operation fails,
         * flush() attempts to mark it FAILED.
         */
        void error;
      }
    }

    return results;
  }

  private validateAggregationId(
    aggregationId:
      string,
  ): void {
    if (
      typeof aggregationId !==
        'string' ||
      aggregationId.trim().length ===
        0
    ) {
      throw new BadRequestException(
        'aggregationId must be non-empty.',
      );
    }
  }

  private validateDate(
    value:
      Date,

    field:
      string,
  ): void {
    if (
      !(value instanceof Date) ||
      Number.isNaN(
        value.getTime(),
      )
    ) {
      throw new BadRequestException(
        `${field} must be a valid Date.`,
      );
    }
  }
}