import { describe, expect, it, vi } from 'vitest';

import type { Queue } from 'bullmq';

import { BullMqCourseOutboxDispatchHandler } from './course-outbox-dispatch.handler.js';

import {
  COURSE_OUTBOX_AGGREGATE_TYPE,
  COURSE_OUTBOX_EVENT_TYPES,
  type CourseOutboxDispatchEvent,
} from './course-outbox-dispatch.contracts.js';

import { getCourseOutboxRetryPolicy } from './course-outbox-retry.policy.js';

function createQueueMock() {
  return {
    add: vi.fn().mockResolvedValue({}),

    close: vi.fn().mockResolvedValue(undefined),
  };
}

function createCourseEvent(
  overrides: Partial<CourseOutboxDispatchEvent> = {},
): CourseOutboxDispatchEvent {
  return {
    id: 'outbox-course-001',

    eventType: COURSE_OUTBOX_EVENT_TYPES.CREATED,

    aggregateType: COURSE_OUTBOX_AGGREGATE_TYPE,

    aggregateId: 'course-001',

    dedupeKey: 'course-domain-event:event-001',

    attempts: 1,

    payload: {
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
    },

    ...overrides,
  };
}

describe('BullMqCourseOutboxDispatchHandler', () => {
  it('publishes the complete Course event envelope to the Course queue', async () => {
    const queue = createQueueMock();

    const handler = new BullMqCourseOutboxDispatchHandler(
      queue as unknown as Queue,
    );

    const event = createCourseEvent();

    const result = await handler.dispatch(event);

    expect(result).toEqual({
      dispatched: true,

      idempotent: true,
    });

    expect(queue.add).toHaveBeenCalledTimes(1);

    expect(queue.add).toHaveBeenCalledWith(
      COURSE_OUTBOX_EVENT_TYPES.CREATED,

      expect.objectContaining({
        outboxEventId: 'outbox-course-001',

        dedupeKey: 'course-domain-event:event-001',

        aggregateId: 'course-001',

        event: expect.objectContaining({
          eventId: 'event-001',

          eventName: COURSE_OUTBOX_EVENT_TYPES.CREATED,

          eventVersion: 1,

          aggregateId: 'course-001',

          occurredAt: '2026-09-23T10:00:00.000Z',

          payload: expect.objectContaining({
            courseId: 'course-001',
          }),
        }),
      }),

      expect.objectContaining({
        jobId: 'course-event-event-001',

        attempts: getCourseOutboxRetryPolicy().maxAttempts,

        backoff: expect.objectContaining({
          type: getCourseOutboxRetryPolicy().backoffType,

          delay: getCourseOutboxRetryPolicy().initialDelayMs,
        }),

        removeOnComplete: 100,

        removeOnFail: 1000,
      }),
    );
  });

  it('uses the durable eventId as the deterministic transport job identity', async () => {
    const queue = createQueueMock();

    const handler = new BullMqCourseOutboxDispatchHandler(
      queue as unknown as Queue,
    );

    await handler.dispatch(
      createCourseEvent({
        payload: {
          ...createCourseEvent().payload,

          eventId: 'event-xyz',
        },
      }),
    );

    expect(queue.add).toHaveBeenCalledWith(
      COURSE_OUTBOX_EVENT_TYPES.CREATED,

      expect.anything(),

      expect.objectContaining({
        jobId: 'course-event-event-xyz',
      }),
    );
  });

  it('reports transport-level idempotency for repeated dispatch of the same event identity', async () => {
    const queue = createQueueMock();

    const handler = new BullMqCourseOutboxDispatchHandler(
      queue as unknown as Queue,
    );

    const event = createCourseEvent();

    const first = await handler.dispatch(event);

    const second = await handler.dispatch(event);

    expect(first).toEqual({
      dispatched: true,

      idempotent: true,
    });

    expect(second).toEqual({
      dispatched: true,

      idempotent: true,
    });

    expect(queue.add).toHaveBeenCalledTimes(2);

    const firstOptions = queue.add.mock.calls[0]?.[2];

    const secondOptions = queue.add.mock.calls[1]?.[2];

    expect(firstOptions).toMatchObject({
      jobId: 'course-event-event-001',
    });

    expect(secondOptions).toMatchObject({
      jobId: 'course-event-event-001',
    });
  });

  it('applies the independent Course BullMQ retry policy', async () => {
    const queue = createQueueMock();

    const handler = new BullMqCourseOutboxDispatchHandler(
      queue as unknown as Queue,
    );

    await handler.dispatch(createCourseEvent());

    const options = queue.add.mock.calls[0]?.[2] as {
      attempts: number;

      backoff: {
        type: string;

        delay: number;
      };
    };

    const policy = getCourseOutboxRetryPolicy();

    expect(options.attempts).toBe(policy.maxAttempts);

    expect(options.backoff).toEqual({
      type: policy.backoffType,

      delay: policy.initialDelayMs,
    });
  });

  it('normalizes a Date timestamp to an ISO string', async () => {
    const queue = createQueueMock();

    const handler = new BullMqCourseOutboxDispatchHandler(
      queue as unknown as Queue,
    );

    await handler.dispatch(
      createCourseEvent({
        payload: {
          ...createCourseEvent().payload,

          occurredAt: new Date('2026-09-23T11:30:00.000Z'),
        },
      }),
    );

    expect(queue.add).toHaveBeenCalledWith(
      COURSE_OUTBOX_EVENT_TYPES.CREATED,

      expect.objectContaining({
        event: expect.objectContaining({
          occurredAt: '2026-09-23T11:30:00.000Z',
        }),
      }),

      expect.anything(),
    );
  });

  it('preserves event payload without reconstructing it', async () => {
    const queue = createQueueMock();

    const handler = new BullMqCourseOutboxDispatchHandler(
      queue as unknown as Queue,
    );

    const event = createCourseEvent({
      payload: {
        ...createCourseEvent().payload,

        payload: {
          courseId: 'course-999',

          title: 'Historical Course',

          nested: {
            original: true,
          },
        },
      },
    });

    await handler.dispatch(event);

    const [, data] = queue.add.mock.calls[0] as [
      unknown,

      {
        event: {
          payload: unknown;
        };
      },

      unknown,
    ];

    expect(data.event.payload).toEqual(event.payload.payload);
  });

  it('does not dispatch a Notification-shaped event through the Course handler', async () => {
    const queue = createQueueMock();

    const handler = new BullMqCourseOutboxDispatchHandler(
      queue as unknown as Queue,
    );

    const invalidEvent = {
      ...createCourseEvent(),

      aggregateType: 'Notification',

      eventType: 'notification.enqueue',
    };

    await expect(handler.dispatch(invalidEvent as never)).rejects.toThrow(
      'Invalid Course Outbox dispatch event.',
    );

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('propagates BullMQ publication failures to the Outbox dispatcher', async () => {
    const queue = createQueueMock();

    const failure = new Error('Course queue unavailable.');

    queue.add.mockRejectedValue(failure);

    const handler = new BullMqCourseOutboxDispatchHandler(
      queue as unknown as Queue,
    );

    await expect(handler.dispatch(createCourseEvent())).rejects.toThrow(
      'Course queue unavailable.',
    );
  });

  it('rejects an invalid occurredAt value before queue publication', async () => {
    const queue = createQueueMock();

    const handler = new BullMqCourseOutboxDispatchHandler(
      queue as unknown as Queue,
    );

    await expect(
      handler.dispatch(
        createCourseEvent({
          payload: {
            ...createCourseEvent().payload,

            occurredAt: 'not-a-valid-date',
          },
        }),
      ),
    ).rejects.toThrow('Course Outbox event occurredAt is invalid.');

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('closes the Course queue during shutdown', async () => {
    const queue = createQueueMock();

    const handler = new BullMqCourseOutboxDispatchHandler(
      queue as unknown as Queue,
    );

    await handler.close();

    expect(queue.close).toHaveBeenCalledTimes(1);
  });
});
