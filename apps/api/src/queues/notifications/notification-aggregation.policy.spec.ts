import { describe, expect, it } from 'vitest';

import { BadRequestException } from '@nestjs/common';

import {
  createNotificationAggregationGroupIdentity,
  NotificationAggregationPolicy,
} from './notification-aggregation.policy.js';

describe('NotificationAggregationPolicy', () => {
  it('creates a deterministic group identity', () => {
    const request = {
      userId: 'user-001',

      channel: 'email' as const,

      category: 'course.activity',

      aggregationKey: 'course-123',

      locale: 'en-IN',

      sourceEventId: 'event-001',

      occurredAt: new Date('2026-08-26T09:00:00.000Z'),
    };

    const first = createNotificationAggregationGroupIdentity(request);

    const second = createNotificationAggregationGroupIdentity({
      ...request,
    });

    expect(first).toEqual(second);

    expect(first.groupKey).toBe(
      'user-001|email|course.activity|course-123|en-IN',
    );
  });

  it('keeps channels in independent aggregation identities', () => {
    const base = {
      userId: 'user-001',

      category: 'course.activity',

      aggregationKey: 'course-123',

      locale: 'en-IN',

      sourceEventId: 'event-001',

      occurredAt: new Date('2026-08-26T09:00:00.000Z'),
    };

    const email = createNotificationAggregationGroupIdentity({
      ...base,

      channel: 'email',
    });

    const push = createNotificationAggregationGroupIdentity({
      ...base,

      channel: 'push',
    });

    expect(email.groupKey).not.toBe(push.groupKey);
  });

  it('keeps locales in independent aggregation identities', () => {
    const base = {
      userId: 'user-001',

      channel: 'email' as const,

      category: 'course.activity',

      aggregationKey: 'course-123',

      sourceEventId: 'event-001',

      occurredAt: new Date('2026-08-26T09:00:00.000Z'),
    };

    const english = createNotificationAggregationGroupIdentity({
      ...base,

      locale: 'en-IN',
    });

    const hindi = createNotificationAggregationGroupIdentity({
      ...base,

      locale: 'hi-IN',
    });

    expect(english.groupKey).not.toBe(hindi.groupKey);
  });

  it('rejects an empty user identity', () => {
    expect(() =>
      createNotificationAggregationGroupIdentity({
        userId: '   ',

        channel: 'email',

        category: 'course.activity',

        aggregationKey: 'course-123',

        locale: 'en-IN',

        sourceEventId: 'event-001',

        occurredAt: new Date('2026-08-26T09:00:00.000Z'),
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects an empty aggregation key', () => {
    const policy = new NotificationAggregationPolicy();

    expect(() =>
      policy.validateRequest({
        userId: 'user-001',

        channel: 'email',

        category: 'course.activity',

        aggregationKey: '   ',

        locale: 'en-IN',

        sourceEventId: 'event-001',

        occurredAt: new Date('2026-08-26T09:00:00.000Z'),
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects an invalid aggregation configuration', () => {
    expect(
      () =>
        new NotificationAggregationPolicy({
          maximumItems: 0,
        }),
    ).toThrow('maximumItems must be a positive integer.');

    expect(
      () =>
        new NotificationAggregationPolicy({
          windowSeconds: 0,
        }),
    ).toThrow('windowSeconds must be a positive integer.');
  });

  it('uses default aggregation configuration when values are omitted', () => {
    const policy = new NotificationAggregationPolicy();

    expect(policy.getMaximumItems()).toBe(50);

    expect(policy.getWindowSeconds()).toBe(300);
  });

  it('allows overriding only the maximum item count', () => {
    const policy = new NotificationAggregationPolicy({
      maximumItems: 10,
    });

    expect(policy.getMaximumItems()).toBe(10);

    expect(policy.getWindowSeconds()).toBe(300);
  });

  it('allows overriding only the aggregation window', () => {
    const policy = new NotificationAggregationPolicy({
      windowSeconds: 600,
    });

    expect(policy.getMaximumItems()).toBe(50);

    expect(policy.getWindowSeconds()).toBe(600);
  });

  it('calculates the aggregation window end', () => {
    const policy = new NotificationAggregationPolicy({
      windowSeconds: 300,
    });

    const start = new Date('2026-08-26T09:00:00.000Z');

    expect(policy.getWindowEnd(start)).toEqual(
      new Date('2026-08-26T09:05:00.000Z'),
    );
  });

  it('accepts events inside the aggregation window', () => {
    const policy = new NotificationAggregationPolicy({
      windowSeconds: 300,
    });

    const start = new Date('2026-08-26T09:00:00.000Z');

    expect(
      policy.isWithinWindow(new Date('2026-08-26T09:04:59.999Z'), start),
    ).toBe(true);
  });

  it('rejects events at the exact end of the aggregation window', () => {
    const policy = new NotificationAggregationPolicy({
      windowSeconds: 300,
    });

    const start = new Date('2026-08-26T09:00:00.000Z');

    expect(
      policy.isWithinWindow(new Date('2026-08-26T09:05:00.000Z'), start),
    ).toBe(false);
  });

  it('enforces the maximum item count', () => {
    const policy = new NotificationAggregationPolicy({
      maximumItems: 3,
    });

    expect(policy.canAcceptItem(0)).toBe(true);

    expect(policy.canAcceptItem(2)).toBe(true);

    expect(policy.canAcceptItem(3)).toBe(false);
  });

  it('rejects a negative current item count', () => {
    const policy = new NotificationAggregationPolicy();

    expect(() => policy.canAcceptItem(-1)).toThrow(
      'currentItemCount must be a non-negative integer.',
    );
  });

  it('rejects a non-integer current item count', () => {
    const policy = new NotificationAggregationPolicy();

    expect(() => policy.canAcceptItem(1.5)).toThrow(
      'currentItemCount must be a non-negative integer.',
    );
  });

  it('creates deterministic ordering keys', () => {
    const policy = new NotificationAggregationPolicy();

    const occurredAt = new Date('2026-08-26T09:00:00.123Z');

    const first = policy.createOrderingKey({
      occurredAt,

      sourceEventId: 'event-001',
    });

    const second = policy.createOrderingKey({
      occurredAt,

      sourceEventId: 'event-002',
    });

    expect(first).not.toBe(second);

    expect(first < second).toBe(true);
  });

  it('rejects an invalid event timestamp', () => {
    const policy = new NotificationAggregationPolicy();

    expect(() =>
      policy.validateRequest({
        userId: 'user-001',

        channel: 'email',

        category: 'course.activity',

        aggregationKey: 'course-123',

        locale: 'en-IN',

        sourceEventId: 'event-001',

        occurredAt: new Date('invalid'),
      }),
    ).toThrow('occurredAt must be a valid Date.');
  });

  it('accepts all currently supported channels', () => {
    const policy = new NotificationAggregationPolicy();

    for (const channel of ['email', 'in-app', 'push'] as const) {
      expect(() =>
        policy.validateRequest({
          userId: 'user-001',

          channel,

          category: 'course.activity',

          aggregationKey: 'course-123',

          locale: 'en-IN',

          sourceEventId: `event-${channel}`,

          occurredAt: new Date('2026-08-26T09:00:00.000Z'),
        }),
      ).not.toThrow();
    }
  });
});
