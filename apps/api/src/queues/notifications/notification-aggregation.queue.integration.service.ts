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
  readonly aggregationId: string;

  readonly notificationId: string;

  readonly queue: string;

  readonly jobId: string;

  readonly outboxEventId: string;

  readonly itemCount: number;

  readonly status: 'FLUSHED';
}

/**
 * Integrates an expired notification aggregation with the
 * existing notification queue pipeline.
 *
 * Responsibilities:
 *
 * 1. Resolve an expired aggregation snapshot.
 * 2. Claim the aggregation for flushing.
 * 3. Resolve persisted source-event identities.
 * 4. Build one NotificationJobData object.
 * 5. Submit that NotificationJobData through the existing
 *    NotificationQueueService.
 * 6. Mark the aggregation as FLUSHED after successful enqueue.
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
   * The operation is intentionally idempotent at the queue
   * boundary because NotificationQueueService already protects
   * notification creation through its idempotency key.
   */
  async flush(
    aggregationId: string,
    now: Date = new Date(),
  ): Promise<NotificationAggregationQueueIntegrationResult> {
    this.validateAggregationId(
      aggregationId,
    );

    this.validateDate(
      now,
      'now',
    );

    const snapshot =
      await this.flushService.getExpiredSnapshot(
        aggregationId,
        now,
      );

    if (
      snapshot === null
    ) {
      throw new BadRequestException(
        `Notification aggregation "${aggregationId}" is not eligible for flushing.`,
      );
    }

    /*
     * Claim the aggregation before doing the potentially
     * expensive source-event resolution and notification build.
     *
     * The repository/service layer remains authoritative for
     * the persisted status transition.
     */
    await this.flushService.markFlushing(
      aggregationId,
    );

    try {
      if (
        snapshot.items.length ===
        0
      ) {
        throw new BadRequestException(
          `Notification aggregation "${aggregationId}" contains no items.`,
        );
      }

      const sourceEventIds =
        snapshot.items.map(
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
            snapshot.group,

          items:
            snapshot.items,

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
          snapshot.items.length,

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
   */
  async flushExpired(
    now: Date = new Date(),
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
         * aggregations. The individual flush() call has
         * already transitioned the failed aggregation to
         * FAILED.
         */
        void error;
      }
    }

    return results;
  }

  private validateAggregationId(
    aggregationId: string,
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
    value: Date,
    field: string,
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