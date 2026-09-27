import { randomUUID } from 'node:crypto';

import { Queue, type Job } from 'bullmq';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getRedisConfig } from '@gurusthalam/config';

import { QUEUE_NAMES, QUEUE_PREFIX } from '../queues/queue.constants.js';

import {
  COURSE_OUTBOX_AGGREGATE_TYPE,
  COURSE_OUTBOX_EVENT_TYPES,
  type CourseOutboxDispatchEvent,
} from './course-outbox-dispatch.contracts.js';

import {
  BullMqCourseOutboxDispatchHandler,
  type CourseOutboxQueueJobData,
} from './course-outbox-dispatch.handler.js';

import { getCourseOutboxRetryPolicy } from './course-outbox-retry.policy.js';

const REDIS_URL = process.env.REDIS_URL;

const describeRedis = REDIS_URL ? describe : describe.skip;

function createCourseEvent(
  overrides: Partial<CourseOutboxDispatchEvent> = {},
): CourseOutboxDispatchEvent {
  const courseId = `redis-course-${randomUUID()}`;
  const eventId = `redis-event-${randomUUID()}`;

  return {
    id: `redis-outbox-${randomUUID()}`,

    eventType: COURSE_OUTBOX_EVENT_TYPES.CREATED,

    aggregateType: COURSE_OUTBOX_AGGREGATE_TYPE,

    aggregateId: courseId,

    dedupeKey: `course-domain-event:${eventId}`,

    attempts: 1,

    payload: {
      eventId,

      eventName: COURSE_OUTBOX_EVENT_TYPES.CREATED,

      eventVersion: 1,

      aggregateId: courseId,

      occurredAt: '2026-09-27T10:00:00.000Z',

      payload: {
        courseId,

        title: 'Redis Integration Course',

        description: 'Production transport integration verification.',

        level: 'BEGINNER',

        type: 'COURSE',

        visibility: 'PRIVATE',

        status: 'DRAFT',

        instructorId: 'redis-integration-instructor',
      },
    },

    ...overrides,
  };
}

function getJobId(event: CourseOutboxDispatchEvent): string {
  return `course-event-${event.payload.eventId}`;
}

function createObserverQueue(): Queue<CourseOutboxQueueJobData> {
  const redis = getRedisConfig();

  return new Queue<CourseOutboxQueueJobData>(QUEUE_NAMES.COURSE_EVENTS, {
    connection: {
      url: redis.url,
    },

    prefix: QUEUE_PREFIX,
  });
}

describeRedis(
  'Course Outbox Dispatch Handler - Redis/BullMQ integration',
  () => {
    let handler: BullMqCourseOutboxDispatchHandler;

    let observerQueue: Queue<CourseOutboxQueueJobData>;

    const createdJobIds: string[] = [];

    beforeAll(async () => {
      handler = BullMqCourseOutboxDispatchHandler.fromRedisConfig();

      observerQueue = createObserverQueue();

      await observerQueue.waitUntilReady();
    });

    afterAll(async () => {
      for (const jobId of createdJobIds) {
        await observerQueue.remove(jobId);
      }

      await handler.close();

      await observerQueue.close();
    });

    it('publishes a real Course job through the production Redis/BullMQ boundary', async () => {
      const event = createCourseEvent();

      const jobId = getJobId(event);

      createdJobIds.push(jobId);

      const result = await handler.dispatch(event);

      expect(result).toEqual({
        dispatched: true,

        idempotent: true,
      });

      const job = await observerQueue.getJob(jobId);

      expect(job).toBeDefined();

      expect(job?.id).toBe(jobId);

      expect(job?.name).toBe(COURSE_OUTBOX_EVENT_TYPES.CREATED);
    });

    it('preserves the complete Course event envelope in the real BullMQ job', async () => {
      const event = createCourseEvent();

      const jobId = getJobId(event);

      createdJobIds.push(jobId);

      await handler.dispatch(event);

      const job = await observerQueue.getJob(jobId);

      expect(job).toBeDefined();

      expect(job?.data).toEqual({
        outboxEventId: event.id,

        dedupeKey: event.dedupeKey,

        aggregateId: event.aggregateId,

        event: {
          eventId: event.payload.eventId,

          eventName: event.payload.eventName,

          eventVersion: event.payload.eventVersion,

          aggregateId: event.payload.aggregateId,

          occurredAt: event.payload.occurredAt,

          payload: event.payload.payload,
        },
      });
    });

    it('preserves the centralized Course BullMQ retry policy in the real job', async () => {
      const event = createCourseEvent();

      const jobId = getJobId(event);

      createdJobIds.push(jobId);

      await handler.dispatch(event);

      const job = await observerQueue.getJob(jobId);

      expect(job).toBeDefined();

      const policy = getCourseOutboxRetryPolicy();

      expect(job?.opts.attempts).toBe(policy.maxAttempts);

      expect(job?.opts.backoff).toEqual({
        type: policy.backoffType,

        delay: policy.initialDelayMs,
      });
    });

    it('reuses the same deterministic transport identity for repeated dispatch of the same Course event', async () => {
      const event = createCourseEvent();

      const jobId = getJobId(event);

      createdJobIds.push(jobId);

      const firstResult = await handler.dispatch(event);

      const secondResult = await handler.dispatch(event);

      expect(firstResult).toEqual({
        dispatched: true,

        idempotent: true,
      });

      expect(secondResult).toEqual({
        dispatched: true,

        idempotent: true,
      });

      const job = await observerQueue.getJob(jobId);

      expect(job).toBeDefined();

      expect(job?.id).toBe(jobId);

      const waitingJobs = await observerQueue.getJobs([
        'waiting',
        'delayed',
        'active',
        'completed',
        'failed',
      ]);

      const matchingJobs = waitingJobs.filter(
        (candidate: Job<CourseOutboxQueueJobData>) => candidate.id === jobId,
      );

      expect(matchingJobs).toHaveLength(1);
    });

    it('normalizes a Date timestamp before it reaches the real BullMQ transport', async () => {
      const event = createCourseEvent();

      const dateEvent: CourseOutboxDispatchEvent = {
        ...event,

        payload: {
          ...event.payload,

          occurredAt: new Date('2026-09-27T12:30:00.000Z'),
        },
      };

      const jobId = getJobId(dateEvent);

      createdJobIds.push(jobId);

      await handler.dispatch(dateEvent);

      const job = await observerQueue.getJob(jobId);

      expect(job).toBeDefined();

      expect(job?.data.event.occurredAt).toBe('2026-09-27T12:30:00.000Z');
    });

    it('keeps Course transport isolated from Notification events', async () => {
      const event = createCourseEvent();

      const invalidEvent = {
        ...event,

        aggregateType: 'Notification',

        eventType: 'notification.enqueue',
      };

      const jobId = getJobId(event);

      createdJobIds.push(jobId);

      await expect(handler.dispatch(invalidEvent as never)).rejects.toThrow(
        'Invalid Course Outbox dispatch event.',
      );

      const job = await observerQueue.getJob(jobId);

      expect(job).toBeUndefined();
    });
  },
);
