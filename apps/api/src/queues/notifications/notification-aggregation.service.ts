import {
  randomUUID,
} from 'node:crypto';

import {
  Injectable,
} from '@nestjs/common';

import {
  NotificationAggregationPolicy,
} from './notification-aggregation.policy.js';

import {
  NotificationAggregationRepository,
} from './notification-aggregation.repository.js';

import type {
  NotificationAggregationGroupIdentity,
  NotificationAggregationRequest,
} from './notification-aggregation.types.js';

import type {
  NotificationAggregationRepositoryGroup,
  NotificationAggregationRepositoryItem,
} from './notification-aggregation.repository.js';

export interface AddNotificationAggregationEventResult {
  readonly group:
    NotificationAggregationRepositoryGroup;

  readonly item:
    | NotificationAggregationRepositoryItem
    | null;

  readonly inserted:
    boolean;

  readonly shouldFlush:
    boolean;

  readonly reason:
    | 'created'
    | 'added'
    | 'duplicate'
    | 'window-expired'
    | 'maximum-items';
}

export interface ExpiredNotificationAggregationResult {
  readonly aggregationId:
    string;

  readonly itemCount:
    number;
}

@Injectable()
export class NotificationAggregationService {
  constructor(
    private readonly repository:
      NotificationAggregationRepository,

    private readonly policy:
      NotificationAggregationPolicy =
        new NotificationAggregationPolicy(),
  ) {}

  /**
   * Finds an aggregation group for the supplied request,
   * or creates it when it does not already exist.
   */
  async getOrCreateGroup(
    request:
      NotificationAggregationRequest,
  ): Promise<
    NotificationAggregationRepositoryGroup
  > {
    const identity =
      this.policy.validateRequest(
        request,
      );

    const windowStart =
      request.occurredAt;

    const windowEnd =
      this.policy.getWindowEnd(
        windowStart,
      );

    return this.repository.createGroupIfAbsent({
      aggregationId:
        this.createAggregationId(
          identity,
        ),

      identity,

      windowStart,

      windowEnd,
    });
  }

  /**
   * Returns an aggregation group by its persisted
   * application-level aggregation identifier.
   *
   * Returns null when the group does not exist.
   *
   * This method keeps the flush workflow behind the
   * application-service boundary instead of allowing the
   * flush service to access the repository directly.
   */
  async findByAggregationId(
    aggregationId:
      string,
  ): Promise<
    NotificationAggregationRepositoryGroup | null
  > {
    return this.repository.findByAggregationId(
      aggregationId,
    );
  }

  /**
   * Adds a notification event to an aggregation group.
   *
   * The policy owns validation and aggregation rules.
   *
   * The repository owns transactional exactly-once
   * persistence and source-event idempotency.
   */
  async addEvent(
    request:
      NotificationAggregationRequest,
  ): Promise<
    AddNotificationAggregationEventResult
  > {
    const identity =
      this.policy.validateRequest(
        request,
      );

    const group =
      await this.repository.createGroupIfAbsent({
        aggregationId:
          this.createAggregationId(
            identity,
          ),

        identity,

        windowStart:
          request.occurredAt,

        windowEnd:
          this.policy.getWindowEnd(
            request.occurredAt,
          ),
      });

    /*
     * Aggregation windows are half-open:
     *
     *   [windowStart, windowEnd)
     *
     * An event occurring exactly at windowEnd
     * therefore belongs outside this aggregation window.
     */
    if (
      !this.policy.isWithinWindow(
        request.occurredAt,
        group.windowStart,
      )
    ) {
      return {
        group,

        item:
          null,

        inserted:
          false,

        shouldFlush:
          true,

        reason:
          'window-expired',
      };
    }

    /*
     * The persisted itemCount represents the number
     * of successfully inserted aggregation items.
     */
    if (
      !this.policy.canAcceptItem(
        group.itemCount,
      )
    ) {
      return {
        group,

        item:
          null,

        inserted:
          false,

        shouldFlush:
          true,

        reason:
          'maximum-items',
      };
    }

    const result =
      await this.repository.addItem({
        aggregationId:
          group.aggregationId,

        itemId:
          this.createItemId(),

        sourceEventId:
          request.sourceEventId,

        occurredAt:
          request.occurredAt,

        orderingKey:
          this.policy.createOrderingKey(
            request,
          ),
      });

    /*
     * The repository uses sourceEventId as the
     * idempotency identity within an aggregation.
     *
     * A duplicate must never increment itemCount.
     */
    if (!result.inserted) {
      return {
        group,

        item:
          result.item,

        inserted:
          false,

        shouldFlush:
          false,

        reason:
          'duplicate',
      };
    }

    /*
     * Refresh the group after successful insertion
     * so the returned itemCount reflects persistence.
     */
    const updatedGroup =
      await this.repository.findByAggregationId(
        group.aggregationId,
      );

    if (
      updatedGroup === null
    ) {
      throw new Error(
        `Notification aggregation "${group.aggregationId}" disappeared after item insertion.`,
      );
    }

    const shouldFlush =
      !this.policy.canAcceptItem(
        updatedGroup.itemCount,
      );

    return {
      group:
        updatedGroup,

      item:
        result.item,

      inserted:
        true,

      shouldFlush,

      reason:
        shouldFlush
          ? 'maximum-items'
          : 'added',
    };
  }

  /**
   * Marks an aggregation group as currently being flushed.
   */
  async markFlushing(
    aggregationId:
      string,
  ): Promise<
    NotificationAggregationRepositoryGroup
  > {
    return this.repository.updateStatus(
      aggregationId,
      'FLUSHING',
    );
  }

  /**
   * Marks an aggregation group as successfully flushed.
   */
  async markFlushed(
    aggregationId:
      string,
  ): Promise<
    NotificationAggregationRepositoryGroup
  > {
    return this.repository.updateStatus(
      aggregationId,
      'FLUSHED',
    );
  }

  /**
   * Marks an aggregation group as failed during flushing.
   */
  async markFailed(
    aggregationId:
      string,
  ): Promise<
    NotificationAggregationRepositoryGroup
  > {
    return this.repository.updateStatus(
      aggregationId,
      'FAILED',
    );
  }

  /**
   * Returns aggregation items in their deterministic
   * repository-defined ordering.
   */
  async getItems(
    aggregationId:
      string,
  ): Promise<
    NotificationAggregationRepositoryItem[]
  > {
    return this.repository.listItems(
      aggregationId,
    );
  }

  /**
   * Returns the persisted aggregation item count.
   */
  async getItemCount(
    aggregationId:
      string,
  ): Promise<number> {
    return this.repository.getItemCount(
      aggregationId,
    );
  }

  /**
   * Finds OPEN aggregation groups whose aggregation
   * windows have expired.
   */
  async findExpiredGroups(
    now:
      Date = new Date(),
  ): Promise<
    NotificationAggregationRepositoryGroup[]
  > {
    return this.repository.findOpenExpiredGroups(
      now,
    );
  }

  /**
   * Creates the public aggregation identifier.
   *
   * The deterministic groupKey remains the database
   * uniqueness identity.
   *
   * aggregationId is an opaque application-level ID.
   */
  private createAggregationId(
    identity:
      NotificationAggregationGroupIdentity,
  ): string {
    return `aggregation-${this.deterministicIdentifier(
      identity.groupKey,
    )}`;
  }

  /**
   * Creates the item identifier.
   */
  private createItemId(): string {
    return randomUUID();
  }

  /**
   * Creates a deterministic, non-cryptographic identifier
   * from the canonical aggregation group key.
   *
   * Database uniqueness remains the authoritative
   * protection against duplicate groups.
   */
  private deterministicIdentifier(
    value:
      string,
  ): string {
    let hash =
      2166136261;

    for (
      let index = 0;
      index < value.length;
      index += 1
    ) {
      hash ^=
        value.charCodeAt(
          index,
        );

      hash =
        Math.imul(
          hash,
          16777619,
        );
    }

    return (
      hash >>> 0
    )
      .toString(16)
      .padStart(
        8,
        '0',
      );
  }
}