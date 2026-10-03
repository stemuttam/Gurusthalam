import { randomUUID } from 'node:crypto';

import { Queue, QueueEvents, Worker, type Job } from 'bullmq';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { getRedisConfig } from '@gurusthalam/config';

import {
  COURSE_OUTBOX_AGGREGATE_TYPE,
  type CourseOutboxDispatchEvent,
  type OutboxJsonValue,
} from './course-outbox-dispatch.contracts.js';

import {
  BullMqCourseOutboxDispatchHandler,
  type CourseOutboxQueueJobData,
} from './course-outbox-dispatch.handler.js';

import { getCourseOutboxRetryPolicy } from './course-outbox-retry.policy.js';

import { QUEUE_NAMES, QUEUE_PREFIX } from '../queues/queue.constants.js';

import {
  CourseDomainEventName,
  CourseLevel,
  CourseProjectionEventHandler,
  CourseStatus,
  CourseType,
  CourseVisibility,
  createDomainEvent,
  type CourseCatalogProjection,
  type CourseDomainEvent,
  type CourseProjectionPersistence,
  type CourseSearchProjection,
} from '@gurusthalam/courses';

const REDIS_URL = process.env.REDIS_URL;

const describeRedis = REDIS_URL ? describe : describe.skip;

interface InMemoryCourseProjectionState {
  readonly catalog: Map<string, CourseCatalogProjection>;
  readonly search: Map<string, CourseSearchProjection>;
}

/**
 * Test-only projection persistence.
 *
 * The real CourseProjectionEventHandler is retained.
 *
 * Failure injection is scoped by courseId so that another integration
 * test sharing the Course BullMQ queue cannot accidentally consume the
 * failure budget belonging to this test.
 */
class InMemoryCourseProjectionPersistence implements CourseProjectionPersistence {
  readonly state: InMemoryCourseProjectionState = {
    catalog: new Map<string, CourseCatalogProjection>(),
    search: new Map<string, CourseSearchProjection>(),
  };

  readonly catalogUpsertAttempts = new Map<string, number>();

  readonly transientFailureBudget = new Map<string, number>();

  readonly permanentFailureCourseIds = new Set<string>();

  readonly catalog = {
    upsert: async (projection: CourseCatalogProjection): Promise<boolean> => {
      const attempts =
        (this.catalogUpsertAttempts.get(projection.courseId) ?? 0) + 1;

      this.catalogUpsertAttempts.set(projection.courseId, attempts);

      const remainingFailures =
        this.transientFailureBudget.get(projection.courseId) ?? 0;

      if (remainingFailures > 0) {
        this.transientFailureBudget.set(
          projection.courseId,
          remainingFailures - 1,
        );

        throw new Error(
          'Phase 4.17-D simulated Course catalog persistence failure.',
        );
      }

      if (this.permanentFailureCourseIds.has(projection.courseId)) {
        throw new Error(
          'Phase 4.17-D simulated Course catalog persistence failure.',
        );
      }

      const current = this.state.catalog.get(projection.courseId);

      if (
        current !== undefined &&
        current.updatedAt.getTime() > projection.updatedAt.getTime()
      ) {
        return false;
      }

      this.state.catalog.set(projection.courseId, projection);

      return true;
    },

    findByCourseId: async (
      courseId: string,
    ): Promise<CourseCatalogProjection | null> =>
      this.state.catalog.get(courseId) ?? null,

    removeByCourseId: async (courseId: string): Promise<void> => {
      this.state.catalog.delete(courseId);
    },
  };

  readonly search = {
    upsert: async (projection: CourseSearchProjection): Promise<boolean> => {
      const current = this.state.search.get(projection.courseId);

      if (
        current !== undefined &&
        current.updatedAt.getTime() > projection.updatedAt.getTime()
      ) {
        return false;
      }

      this.state.search.set(projection.courseId, projection);

      return true;
    },

    findByCourseId: async (
      courseId: string,
    ): Promise<CourseSearchProjection | null> =>
      this.state.search.get(courseId) ?? null,

    removeByCourseId: async (courseId: string): Promise<void> => {
      this.state.search.delete(courseId);
    },
  };

  clear(): void {
    this.state.catalog.clear();
    this.state.search.clear();
    this.catalogUpsertAttempts.clear();
    this.transientFailureBudget.clear();
    this.permanentFailureCourseIds.clear();
  }
}

function createCourseCreatedEvent(
  courseId: string,
  occurredAt: Date,
): CourseDomainEvent {
  return createDomainEvent(
    CourseDomainEventName.CREATED,
    courseId,
    {
      courseId,

      title: `Phase 4.17-D Course ${courseId}`,

      description: 'Failure and retry integration course.',

      level: CourseLevel.BEGINNER,

      type: CourseType.SELF_PACED,

      visibility: CourseVisibility.PUBLIC,

      status: CourseStatus.DRAFT,

      instructorId: `phase-4-17-d-instructor-${courseId}`,
    },
    occurredAt,
  );
}

function toOutboxJsonValue(value: unknown): OutboxJsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => toOutboxJsonValue(item));
  }

  if (typeof value === 'object') {
    const result: Record<string, OutboxJsonValue> = {};

    for (const [key, item] of Object.entries(value)) {
      result[key] = toOutboxJsonValue(item);
    }

    return result;
  }

  throw new TypeError(
    `Course Outbox payload contains a non-JSON-compatible value of type "${typeof value}".`,
  );
}

function createOutboxDispatchEvent(
  event: CourseDomainEvent,
): CourseOutboxDispatchEvent {
  return {
    id: `phase-4-17-d-outbox-${randomUUID()}`,

    eventType: event.eventName,

    aggregateType: COURSE_OUTBOX_AGGREGATE_TYPE,

    aggregateId: event.aggregateId,

    dedupeKey: `phase-4-17-d-event-${event.eventId}`,

    attempts: 1,

    payload: {
      eventId: event.eventId,

      eventName: event.eventName,

      eventVersion: event.eventVersion,

      aggregateId: event.aggregateId,

      occurredAt: event.occurredAt,

      payload: toOutboxJsonValue(event.payload),
    },
  };
}

function deserializeCourseDomainEvent(
  event: CourseOutboxQueueJobData['event'],
): CourseDomainEvent {
  return event as unknown as CourseDomainEvent;
}

function getJobId(event: CourseDomainEvent): string {
  return `course-event-${event.eventId}`;
}

function expectCourseCreatedEvent(event: CourseDomainEvent): Extract<
  CourseDomainEvent,
  {
    eventName: typeof CourseDomainEventName.CREATED;
  }
> {
  expect(event.eventName).toBe(CourseDomainEventName.CREATED);

  if (event.eventName !== CourseDomainEventName.CREATED) {
    throw new Error(
      `Expected ${CourseDomainEventName.CREATED}, received ${event.eventName}.`,
    );
  }

  return event;
}

describeRedis(
  'Course Outbox → projection failure/retry/recovery - Redis/BullMQ integration',
  () => {
    let handler: BullMqCourseOutboxDispatchHandler;

    let observerQueue: Queue<CourseOutboxQueueJobData>;

    let queueEvents: QueueEvents;

    let courseWorker: Worker<CourseOutboxQueueJobData>;

    let projectionPersistence: InMemoryCourseProjectionPersistence;

    let projectionHandler: CourseProjectionEventHandler;

    const createdJobIds = new Set<string>();

    beforeAll(async () => {
      const redis = getRedisConfig();

      observerQueue = new Queue<CourseOutboxQueueJobData>(
        QUEUE_NAMES.COURSE_EVENTS,
        {
          connection: {
            url: redis.url,
          },

          prefix: QUEUE_PREFIX,
        },
      );

      queueEvents = new QueueEvents(QUEUE_NAMES.COURSE_EVENTS, {
        connection: {
          url: redis.url,
        },

        prefix: QUEUE_PREFIX,
      });

      projectionPersistence = new InMemoryCourseProjectionPersistence();

      projectionHandler = new CourseProjectionEventHandler(
        projectionPersistence,
      );

      courseWorker = new Worker<CourseOutboxQueueJobData>(
        QUEUE_NAMES.COURSE_EVENTS,

        async (job: Job<CourseOutboxQueueJobData>) => {
          const event = deserializeCourseDomainEvent(job.data.event);

          await projectionHandler.handle(event);

          return {
            projected: true,
          };
        },

        {
          connection: {
            url: redis.url,
          },

          prefix: QUEUE_PREFIX,

          concurrency: 1,
        },
      );

      courseWorker.on('error', (error: Error) => {
        /*
         * BullMQ requires an error listener so a failed
         * processor attempt does not become an unhandled
         * worker-level error.
         *
         * The actual job failure remains observable through
         * waitUntilFinished().
         */
        void error;
      });

      handler = BullMqCourseOutboxDispatchHandler.fromRedisConfig();

      await observerQueue.waitUntilReady();

      await queueEvents.waitUntilReady();

      await courseWorker.waitUntilReady();
    });

    beforeEach(async () => {
      projectionPersistence.clear();

      for (const jobId of createdJobIds) {
        const job = await observerQueue.getJob(jobId);

        if (job === undefined) {
          continue;
        }

        const state = await job.getState();

        if (
          state === 'completed' ||
          state === 'failed' ||
          state === 'waiting' ||
          state === 'delayed'
        ) {
          await job.remove();
        }
      }

      createdJobIds.clear();
    });

    afterAll(async () => {
      for (const jobId of createdJobIds) {
        const job = await observerQueue.getJob(jobId);

        if (job === undefined) {
          continue;
        }

        const state = await job.getState();

        if (
          state === 'completed' ||
          state === 'failed' ||
          state === 'waiting' ||
          state === 'delayed'
        ) {
          await job.remove();
        }
      }

      await courseWorker.close();

      await queueEvents.close();

      await observerQueue.close();

      await handler.close();
    });

    it('recovers from transient projection persistence failure through the real BullMQ retry policy', async () => {
      const courseId = `phase-4-17-d-course-${randomUUID()}`;

      const event = createCourseCreatedEvent(courseId, new Date());

      const createdEvent = expectCourseCreatedEvent(event);

      const jobId = getJobId(event);

      createdJobIds.add(jobId);

      const retryPolicy = getCourseOutboxRetryPolicy();

      expect(retryPolicy.maxAttempts).toBeGreaterThan(1);

      /*
       * Fail every attempt except the final allowed
       * attempt.
       *
       * With the current production policy:
       *
       * attempt 1 -> failure
       * wait 1 second
       * attempt 2 -> failure
       * wait 2 seconds
       * attempt 3 -> success
       */
      projectionPersistence.transientFailureBudget.set(
        courseId,
        retryPolicy.maxAttempts - 1,
      );

      const dispatchEvent = createOutboxDispatchEvent(event);

      await handler.dispatch(dispatchEvent);

      const job = await observerQueue.getJob(jobId);

      expect(job).toBeDefined();

      if (job === undefined) {
        throw new Error(`Expected Course job "${jobId}" to exist.`);
      }

      await job.waitUntilFinished(queueEvents, 20_000);

      const completedJob = await observerQueue.getJob(jobId);

      expect(completedJob).toBeDefined();

      expect(completedJob?.attemptsMade).toBe(retryPolicy.maxAttempts);

      expect(projectionPersistence.catalogUpsertAttempts.get(courseId)).toBe(
        retryPolicy.maxAttempts,
      );

      const catalog = projectionPersistence.state.catalog.get(courseId);

      expect(catalog).toMatchObject({
        courseId,

        title: createdEvent.payload.title,

        description: createdEvent.payload.description,

        level: createdEvent.payload.level,

        type: createdEvent.payload.type,

        visibility: createdEvent.payload.visibility,

        status: CourseStatus.DRAFT,

        instructorId: createdEvent.payload.instructorId,
      });

      const search = projectionPersistence.state.search.get(courseId);

      expect(search).toMatchObject({
        courseId,

        title: createdEvent.payload.title,

        description: createdEvent.payload.description,

        level: createdEvent.payload.level,

        type: createdEvent.payload.type,

        visibility: createdEvent.payload.visibility,

        status: CourseStatus.DRAFT,

        instructorId: createdEvent.payload.instructorId,
      });
    }, 25_000);

    it('exhausts the real BullMQ Course retry policy when projection persistence remains unavailable', async () => {
      const courseId = `phase-4-17-d-course-${randomUUID()}`;

      const event = createCourseCreatedEvent(courseId, new Date());

      const jobId = getJobId(event);

      createdJobIds.add(jobId);

      const retryPolicy = getCourseOutboxRetryPolicy();

      projectionPersistence.permanentFailureCourseIds.add(courseId);

      const dispatchEvent = createOutboxDispatchEvent(event);

      await handler.dispatch(dispatchEvent);

      const job = await observerQueue.getJob(jobId);

      expect(job).toBeDefined();

      if (job === undefined) {
        throw new Error(`Expected Course job "${jobId}" to exist.`);
      }

      await expect(job.waitUntilFinished(queueEvents, 20_000)).rejects.toThrow(
        'Phase 4.17-D simulated Course catalog persistence failure.',
      );

      const failedJob = await observerQueue.getJob(jobId);

      expect(failedJob).toBeDefined();

      expect(failedJob?.attemptsMade).toBe(retryPolicy.maxAttempts);

      expect(projectionPersistence.catalogUpsertAttempts.get(courseId)).toBe(
        retryPolicy.maxAttempts,
      );

      expect(projectionPersistence.state.catalog.has(courseId)).toBe(false);

      expect(projectionPersistence.state.search.has(courseId)).toBe(false);
    }, 25_000);
  },
);
