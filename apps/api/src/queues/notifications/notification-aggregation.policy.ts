import { BadRequestException } from '@nestjs/common';

import type {
  NotificationAggregationChannel,
  NotificationAggregationConfig,
  NotificationAggregationGroupIdentity,
  NotificationAggregationRequest,
} from './notification-aggregation.types.js';

const DEFAULT_MAXIMUM_ITEMS = 50;

const DEFAULT_WINDOW_SECONDS = 300;

const GROUP_KEY_SEPARATOR = '|';

function normalizeRequiredString(value: string, field: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new BadRequestException(`${field} must be non-empty.`);
  }

  return normalized;
}

function normalizePositiveInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new BadRequestException(`${field} must be a positive integer.`);
  }

  return value;
}

function assertValidDate(value: Date, field: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new BadRequestException(`${field} must be a valid Date.`);
  }
}

function normalizeChannel(
  channel: NotificationAggregationChannel,
): NotificationAggregationChannel {
  switch (channel) {
    case 'email':
    case 'in-app':
    case 'push':
      return channel;

    default:
      throw new BadRequestException(
        `Unsupported notification aggregation channel "${String(channel)}".`,
      );
  }
}

/**
 * Creates the canonical deterministic identity used to
 * group notification events.
 *
 * Channel and locale are intentionally part of the identity.
 *
 * This function does not hash the key. Keeping the canonical
 * representation human-readable is useful during the domain
 * contract phase and allows the persistence layer introduced
 * in 3.2.20-B to choose an appropriate indexed representation.
 */
export function createNotificationAggregationGroupIdentity(
  request: NotificationAggregationRequest,
): NotificationAggregationGroupIdentity {
  const userId = normalizeRequiredString(request.userId, 'userId');

  const category = normalizeRequiredString(request.category, 'category');

  const aggregationKey = normalizeRequiredString(
    request.aggregationKey,
    'aggregationKey',
  );

  const locale = normalizeRequiredString(request.locale, 'locale');

  const channel = normalizeChannel(request.channel);

  return {
    userId,

    channel,

    category,

    aggregationKey,

    locale,

    groupKey: [userId, channel, category, aggregationKey, locale].join(
      GROUP_KEY_SEPARATOR,
    ),
  };
}

/**
 * Validates and resolves notification aggregation policy
 * configuration.
 *
 * Configuration properties are optional at the boundary so
 * callers may override only the values they need to test or
 * customize. The class always resolves them to concrete,
 * validated numbers before use.
 */
export class NotificationAggregationPolicy {
  private readonly maximumItems: number;

  private readonly windowSeconds: number;

  constructor(config: NotificationAggregationConfig = {}) {
    this.maximumItems = config.maximumItems ?? DEFAULT_MAXIMUM_ITEMS;

    this.windowSeconds = config.windowSeconds ?? DEFAULT_WINDOW_SECONDS;

    this.validateConfiguration();
  }

  getMaximumItems(): number {
    return this.maximumItems;
  }

  getWindowSeconds(): number {
    return this.windowSeconds;
  }

  getWindowEnd(windowStart: Date): Date {
    assertValidDate(windowStart, 'windowStart');

    return new Date(windowStart.getTime() + this.windowSeconds * 1000);
  }

  isWithinWindow(
    occurredAt: Date,

    windowStart: Date,
  ): boolean {
    assertValidDate(occurredAt, 'occurredAt');

    assertValidDate(windowStart, 'windowStart');

    const windowEnd = this.getWindowEnd(windowStart);

    return (
      occurredAt.getTime() >= windowStart.getTime() &&
      occurredAt.getTime() < windowEnd.getTime()
    );
  }

  canAcceptItem(currentItemCount: number): boolean {
    if (!Number.isInteger(currentItemCount) || currentItemCount < 0) {
      throw new BadRequestException(
        'currentItemCount must be a non-negative integer.',
      );
    }

    return currentItemCount < this.maximumItems;
  }

  createOrderingKey(
    request: Pick<
      NotificationAggregationRequest,
      'occurredAt' | 'sourceEventId'
    >,
  ): string {
    assertValidDate(request.occurredAt, 'occurredAt');

    const sourceEventId = normalizeRequiredString(
      request.sourceEventId,
      'sourceEventId',
    );

    /*
     * Millisecond timestamp first gives deterministic
     * chronological ordering. The source event identity is
     * the stable tie-breaker for events with the same timestamp.
     */
    return [
      String(request.occurredAt.getTime()).padStart(16, '0'),
      sourceEventId,
    ].join(GROUP_KEY_SEPARATOR);
  }

  validateRequest(
    request: NotificationAggregationRequest,
  ): NotificationAggregationGroupIdentity {
    if (request === undefined || request === null) {
      throw new BadRequestException(
        'Notification aggregation request is required.',
      );
    }

    assertValidDate(request.occurredAt, 'occurredAt');

    normalizeRequiredString(request.userId, 'userId');

    normalizeRequiredString(request.category, 'category');

    normalizeRequiredString(request.aggregationKey, 'aggregationKey');

    normalizeRequiredString(request.locale, 'locale');

    normalizeRequiredString(request.sourceEventId, 'sourceEventId');

    normalizeChannel(request.channel);

    return createNotificationAggregationGroupIdentity(request);
  }

  private validateConfiguration(): void {
    normalizePositiveInteger(this.maximumItems, 'maximumItems');

    normalizePositiveInteger(this.windowSeconds, 'windowSeconds');
  }
}
