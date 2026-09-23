import { describe, expect, it } from 'vitest';

import {
  COURSE_OUTBOX_AGGREGATE_TYPE,
  COURSE_OUTBOX_EVENT_TYPES,
  isCourseOutboxAggregateType,
  isCourseOutboxDispatchEvent,
  isCourseOutboxDomainEventEnvelope,
  isCourseOutboxEventType,
} from './course-outbox-dispatch.contracts.js';

function createEnvelope() {
  return {
    eventId: 'event-001',

    eventName: COURSE_OUTBOX_EVENT_TYPES.CREATED,

    eventVersion: 1,

    aggregateId: 'course-001',

    occurredAt: '2026-09-23T10:00:00.000Z',

    payload: {
      courseId: 'course-001',

      title: 'Physics',

      description: 'Physics fundamentals',

      level: 'BEGINNER',

      type: 'COURSE',

      visibility: 'PUBLIC',

      status: 'DRAFT',

      instructorId: 'user-001',
    },
  };
}

function createDispatchEvent() {
  return {
    id: 'outbox-001',

    eventType: COURSE_OUTBOX_EVENT_TYPES.CREATED,

    aggregateType: COURSE_OUTBOX_AGGREGATE_TYPE,

    aggregateId: 'course-001',

    dedupeKey: 'course-domain-event:event-001',

    payload: createEnvelope(),

    attempts: 1,
  };
}

describe('Course Outbox dispatch contracts', () => {
  it('recognizes every canonical Course event type', () => {
    for (const eventType of Object.values(COURSE_OUTBOX_EVENT_TYPES)) {
      expect(isCourseOutboxEventType(eventType)).toBe(true);
    }
  });

  it('recognizes the Course aggregate type', () => {
    expect(isCourseOutboxAggregateType(COURSE_OUTBOX_AGGREGATE_TYPE)).toBe(
      true,
    );
  });

  it('rejects the notification event type', () => {
    expect(isCourseOutboxEventType('notification.enqueue')).toBe(false);
  });

  it('rejects arbitrary event types', () => {
    expect(isCourseOutboxEventType('unknown.event')).toBe(false);
  });

  it('rejects the Notification aggregate type', () => {
    expect(isCourseOutboxAggregateType('Notification')).toBe(false);
  });

  it('accepts a complete Course domain-event envelope', () => {
    expect(isCourseOutboxDomainEventEnvelope(createEnvelope())).toBe(true);
  });

  it('rejects an unknown event name', () => {
    expect(
      isCourseOutboxDomainEventEnvelope({
        ...createEnvelope(),

        eventName: 'unknown.event',
      }),
    ).toBe(false);
  });

  it('rejects an invalid event version', () => {
    expect(
      isCourseOutboxDomainEventEnvelope({
        ...createEnvelope(),

        eventVersion: 0,
      }),
    ).toBe(false);
  });

  it('rejects a missing aggregate ID', () => {
    expect(
      isCourseOutboxDomainEventEnvelope({
        ...createEnvelope(),

        aggregateId: '',
      }),
    ).toBe(false);
  });

  it('accepts a complete Course dispatch event', () => {
    expect(isCourseOutboxDispatchEvent(createDispatchEvent())).toBe(true);
  });

  it('preserves event identity', () => {
    const event = createDispatchEvent();

    expect(event.payload.eventId).toBe('event-001');

    expect(event.dedupeKey).toBe('course-domain-event:event-001');
  });

  it('preserves aggregate identity', () => {
    const event = createDispatchEvent();

    expect(event.aggregateId).toBe('course-001');

    expect(event.payload.aggregateId).toBe('course-001');
  });

  it('rejects a Notification aggregate', () => {
    expect(
      isCourseOutboxDispatchEvent({
        ...createDispatchEvent(),

        aggregateType: 'Notification',
      }),
    ).toBe(false);
  });

  it('rejects invalid attempts', () => {
    expect(
      isCourseOutboxDispatchEvent({
        ...createDispatchEvent(),

        attempts: -1,
      }),
    ).toBe(false);
  });

  it('rejects a missing dedupe key', () => {
    expect(
      isCourseOutboxDispatchEvent({
        ...createDispatchEvent(),

        dedupeKey: '',
      }),
    ).toBe(false);
  });

  it('rejects a notification-shaped payload', () => {
    expect(
      isCourseOutboxDispatchEvent({
        ...createDispatchEvent(),

        payload: {
          notificationId: 'notification-001',

          idempotencyKey: 'notification-key',

          channel: 'email',
        },
      }),
    ).toBe(false);
  });

  it('rejects mismatched persisted event type and embedded event name', () => {
    expect(
      isCourseOutboxDispatchEvent({
        ...createDispatchEvent(),

        eventType: COURSE_OUTBOX_EVENT_TYPES.PUBLISHED,

        payload: createEnvelope(),
      }),
    ).toBe(false);
  });

  it('rejects mismatched persisted aggregate ID and embedded aggregate ID', () => {
    expect(
      isCourseOutboxDispatchEvent({
        ...createDispatchEvent(),

        aggregateId: 'course-999',

        payload: createEnvelope(),
      }),
    ).toBe(false);
  });

  it('accepts a Date occurredAt value', () => {
    expect(
      isCourseOutboxDispatchEvent({
        ...createDispatchEvent(),

        payload: {
          ...createEnvelope(),

          occurredAt: new Date('2026-09-23T10:00:00.000Z'),
        },
      }),
    ).toBe(true);
  });

  it('rejects an invalid occurredAt value', () => {
    expect(
      isCourseOutboxDispatchEvent({
        ...createDispatchEvent(),

        payload: {
          ...createEnvelope(),

          occurredAt: 'not-a-date',
        },
      }),
    ).toBe(false);
  });
});
