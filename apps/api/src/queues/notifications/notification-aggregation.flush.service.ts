import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import {
  NotificationAggregationService,
} from './notification-aggregation.service.js';

import type {
  NotificationAggregationRepositoryGroup,
  NotificationAggregationRepositoryItem,
} from './notification-aggregation.repository.js';

/**
 * Resolves the persisted aggregation state that is ready to be
 * converted into an outbound notification.
 *
 * This service intentionally does NOT enqueue a notification yet.
 *
 * The aggregation repository stores source-event identities rather
 * than complete NotificationJobData. Therefore a later application
 * layer must resolve those source events into notification content
 * before NotificationQueueService.enqueue() is called.
 */
export interface NotificationAggregationFlushSnapshot {
  readonly group:
    NotificationAggregationRepositoryGroup;

  readonly items:
    readonly NotificationAggregationRepositoryItem[];
}

@Injectable()
export class NotificationAggregationFlushService {
  constructor(
    private readonly aggregationService:
      NotificationAggregationService,
  ) {}

  /**
   * Returns a deterministic snapshot of an aggregation group
   * that is eligible for flushing.
   *
   * A group is eligible when:
   *
   * - it exists;
   * - it is OPEN;
   * - and its aggregation window has expired.
   */
  async getExpiredSnapshot(
    aggregationId: string,
    now: Date = new Date(),
  ): Promise<NotificationAggregationFlushSnapshot | null> {
    this.validateAggregationId(
      aggregationId,
    );

    this.validateDate(
      now,
      'now',
    );

    const group =
      await this.aggregationService.findByAggregationId(
        aggregationId,
      );

    if (
      group === null ||
      group.status !== 'OPEN'
    ) {
      return null;
    }

    if (
      group.windowEnd.getTime() >
      now.getTime()
    ) {
      return null;
    }

    const items =
      await this.aggregationService.getItems(
        group.aggregationId,
      );

    return {
      group,
      items,
    };
  }

  /**
   * Finds OPEN aggregation groups whose windows have expired
   * and returns their deterministic item snapshots.
   *
   * The groups themselves are already ordered by the repository,
   * while each group's items are ordered by orderingKey and id.
   */
  async findExpiredSnapshots(
    now: Date = new Date(),
  ): Promise<
    NotificationAggregationFlushSnapshot[]
  > {
    this.validateDate(
      now,
      'now',
    );

    const groups =
      await this.aggregationService.findExpiredGroups(
        now,
      );

    const snapshots:
      NotificationAggregationFlushSnapshot[] = [];

    for (
      const group of groups
    ) {
      const items =
        await this.aggregationService.getItems(
          group.aggregationId,
        );

      snapshots.push({
        group,
        items,
      });
    }

    return snapshots;
  }

  /**
   * Claims a group for flushing.
   */
  async markFlushing(
    aggregationId: string,
  ): Promise<NotificationAggregationRepositoryGroup> {
    this.validateAggregationId(
      aggregationId,
    );

    return this.aggregationService.markFlushing(
      aggregationId,
    );
  }

  /**
   * Marks a successfully completed aggregation flush.
   */
  async markFlushed(
    aggregationId: string,
  ): Promise<NotificationAggregationRepositoryGroup> {
    this.validateAggregationId(
      aggregationId,
    );

    return this.aggregationService.markFlushed(
      aggregationId,
    );
  }

  /**
   * Marks an aggregation flush as failed.
   */
  async markFailed(
    aggregationId: string,
  ): Promise<NotificationAggregationRepositoryGroup> {
    this.validateAggregationId(
      aggregationId,
    );

    return this.aggregationService.markFailed(
      aggregationId,
    );
  }

  private validateAggregationId(
    aggregationId: string,
  ): void {
    if (
      typeof aggregationId !== 'string' ||
      aggregationId.trim().length === 0
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
      Number.isNaN(value.getTime())
    ) {
      throw new BadRequestException(
        `${field} must be a valid Date.`,
      );
    }
  }
}