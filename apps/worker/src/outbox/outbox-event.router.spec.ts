import { describe, expect, it } from 'vitest';

import { COURSE_OUTBOX_EVENT_TYPES } from './course-outbox-dispatch.contracts.js';

import {
  NOTIFICATION_OUTBOX_AGGREGATE_TYPE,
  NOTIFICATION_OUTBOX_EVENT_TYPE,
  OUTBOX_DISPATCH_ROUTES,
  UnsupportedOutboxEventRouteError,
  isCourseOutboxRoute,
  isNotificationOutboxRoute,
  resolveOutboxDispatchRoute,
} from './outbox-event.router.js';

describe('Outbox event router', () => {
  it('routes notification.enqueue to the notification route', () => {
    expect(
      resolveOutboxDispatchRoute({
        aggregateType: NOTIFICATION_OUTBOX_AGGREGATE_TYPE,

        eventType: NOTIFICATION_OUTBOX_EVENT_TYPE,
      }),
    ).toBe(OUTBOX_DISPATCH_ROUTES.NOTIFICATION);
  });

  it('routes every canonical Course event to the Course route', () => {
    const eventTypes = Object.values(COURSE_OUTBOX_EVENT_TYPES);

    for (const eventType of eventTypes) {
      expect(
        resolveOutboxDispatchRoute({
          aggregateType: 'Course',

          eventType,
        }),
      ).toBe(OUTBOX_DISPATCH_ROUTES.COURSE);
    }
  });

  it('does not route a Course event when the aggregate type is Notification', () => {
    expect(() =>
      resolveOutboxDispatchRoute({
        aggregateType: NOTIFICATION_OUTBOX_AGGREGATE_TYPE,

        eventType: COURSE_OUTBOX_EVENT_TYPES.CREATED,
      }),
    ).toThrow(UnsupportedOutboxEventRouteError);
  });

  it('does not route notification.enqueue when the aggregate type is Course', () => {
    expect(() =>
      resolveOutboxDispatchRoute({
        aggregateType: 'Course',

        eventType: NOTIFICATION_OUTBOX_EVENT_TYPE,
      }),
    ).toThrow(UnsupportedOutboxEventRouteError);
  });

  it('rejects unknown aggregate/event combinations', () => {
    expect(() =>
      resolveOutboxDispatchRoute({
        aggregateType: 'UnknownAggregate',

        eventType: 'unknown.event',
      }),
    ).toThrow(UnsupportedOutboxEventRouteError);
  });

  it('rejects a valid Course event name paired with an unknown aggregate', () => {
    expect(() =>
      resolveOutboxDispatchRoute({
        aggregateType: 'UnknownAggregate',

        eventType: COURSE_OUTBOX_EVENT_TYPES.CREATED,
      }),
    ).toThrow(UnsupportedOutboxEventRouteError);
  });

  it('identifies the Course route without selecting notification routing', () => {
    const input = {
      aggregateType: 'Course',

      eventType: COURSE_OUTBOX_EVENT_TYPES.PUBLISHED,
    };

    expect(isCourseOutboxRoute(input)).toBe(true);

    expect(isNotificationOutboxRoute(input)).toBe(false);
  });

  it('identifies the notification route without selecting Course routing', () => {
    const input = {
      aggregateType: NOTIFICATION_OUTBOX_AGGREGATE_TYPE,

      eventType: NOTIFICATION_OUTBOX_EVENT_TYPE,
    };

    expect(isNotificationOutboxRoute(input)).toBe(true);

    expect(isCourseOutboxRoute(input)).toBe(false);
  });

  it('includes aggregate and event identity in unsupported-route errors', () => {
    try {
      resolveOutboxDispatchRoute({
        aggregateType: 'Course',

        eventType: 'unsupported.course.event',
      });

      throw new Error('Expected route resolution to fail.');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(UnsupportedOutboxEventRouteError);

      expect(error).toMatchObject({
        aggregateType: 'Course',

        eventType: 'unsupported.course.event',
      });
    }
  });
});
