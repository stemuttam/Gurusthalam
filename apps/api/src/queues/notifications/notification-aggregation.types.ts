import type { NotificationCommandChannel } from './notification.command.js';

export type NotificationAggregationChannel = NotificationCommandChannel;

export type NotificationAggregationStatus =
  'OPEN' | 'FLUSHING' | 'FLUSHED' | 'FAILED';

export type NotificationAggregationDecision =
  'ACCEPTED' | 'DUPLICATE' | 'NOT_ELIGIBLE' | 'WINDOW_FULL' | 'LIMIT_REACHED';

export interface NotificationAggregationConfig {
  /**
   * Maximum number of source notification items that may
   * belong to one aggregation group.
   *
   * When omitted, NotificationAggregationPolicy supplies
   * its domain default.
   */
  readonly maximumItems?: number;

  /**
   * Duration, in seconds, during which an aggregation group
   * accepts new items.
   *
   * When omitted, NotificationAggregationPolicy supplies
   * its domain default.
   */
  readonly windowSeconds?: number;
}

export interface NotificationAggregationRequest {
  /**
   * User receiving the aggregated notification.
   */
  readonly userId: string;

  /**
   * Channel-specific aggregation.
   *
   * Email, push and in-app aggregation are intentionally
   * independent.
   */
  readonly channel: NotificationAggregationChannel;

  /**
   * Stable business aggregation category.
   *
   * Examples:
   *
   * - course.activity
   * - assignment.activity
   * - learning.reminder
   */
  readonly category: string;

  /**
   * Stable caller-controlled grouping key.
   *
   * Notifications with different keys must never enter
   * the same aggregation group.
   */
  readonly aggregationKey: string;

  /**
   * Locale is part of the aggregation identity so content
   * intended for different locales is not silently combined.
   */
  readonly locale: string;

  /**
   * Stable source event identity used for idempotent
   * aggregation-item insertion.
   */
  readonly sourceEventId: string;

  /**
   * Event timestamp used for deterministic ordering and
   * aggregation-window evaluation.
   */
  readonly occurredAt: Date;
}

export interface NotificationAggregationGroupIdentity {
  readonly userId: string;

  readonly channel: NotificationAggregationChannel;

  readonly category: string;

  readonly aggregationKey: string;

  readonly locale: string;

  /**
   * Deterministic canonical identity for the group.
   */
  readonly groupKey: string;
}

export interface NotificationAggregationGroup {
  readonly aggregationId: string;

  readonly identity: NotificationAggregationGroupIdentity;

  readonly status: NotificationAggregationStatus;

  readonly windowStart: Date;

  readonly windowEnd: Date;

  readonly itemCount: number;
}

export interface NotificationAggregationItem {
  readonly itemId: string;

  readonly aggregationId: string;

  readonly sourceEventId: string;

  readonly occurredAt: Date;

  /**
   * Stable ordering value.
   *
   * The aggregation engine must not depend on database
   * insertion order for summary generation.
   */
  readonly orderingKey: string;
}

export interface NotificationAggregationDecisionResult {
  readonly decision: NotificationAggregationDecision;

  readonly aggregationId: string;

  readonly groupKey: string;
}
