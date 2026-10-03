import { randomUUID } from 'node:crypto';

import { Queue, QueueEvents, Worker, type Job } from 'bullmq';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { getRedisConfig } from '@gurusthalam/config';

import {
  createPrismaClient,
  Prisma,
  type PrismaClient,
} from '@gurusthalam/database';

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

import { QUEUE_NAMES, QUEUE_PREFIX } from '../queues/queue.constants.js';

import {
  BullMqCourseOutboxDispatchHandler,
  type CourseOutboxQueueJobData,
} from './course-outbox-dispatch.handler.js';

import {
  COURSE_OUTBOX_AGGREGATE_TYPE,
  type CourseOutboxDispatchEvent,
  type OutboxJsonValue,
} from './course-outbox-dispatch.contracts.js';

import { OutboxDispatcher } from './outbox.dispatcher.js';

const DATABASE_URL = process.env.DATABASE_URL;
const REDIS_URL = process.env.REDIS_URL;

const describeIntegration =
  DATABASE_URL && REDIS_URL ? describe : describe.skip;

interface LoggerMock {
  readonly info: (...args: unknown[]) => void;
  readonly warn: (...args: unknown[]) => void;
  readonly error: (...args: unknown[]) => void;
  readonly debug: (...args: unknown[]) => void;
}

interface DispatcherInternals {
  readonly instanceId: string;
  readonly publish: (event: CourseOutboxDispatchEvent) => Promise<void>;
}

interface DispatcherHandlers {
  readonly courseDispatchHandler: BullMqCourseOutboxDispatchHandler;
}

interface InMemoryCourseProjectionState {
  readonly catalog: Map<string, CourseCatalogProjection>;
  readonly search: Map<string, CourseSearchProjection>;
}

/**
 * Minimal logger implementation required by OutboxDispatcher.
 *
 * The production dispatcher depends on the Gurusthalam logger
 * contract. This integration test only needs the logging surface
 * consumed by the dispatcher boundary.
 */
function createLoggerMock(): LoggerMock {
  return {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
  };
}

/**
 * OutboxDispatcher intentionally keeps its transport internals private.
 *
 * This test-only adapter exposes only the existing dispatcher boundary
 * required to:
 *
 * 1. use the real dispatcher instance identity for the PROCESSING row;
 * 2. invoke the real publish boundary;
 * 3. close the real Course transport handler during teardown.
 *
 * No production visibility is changed.
 */
function getDispatcherInternals(
  dispatcher: OutboxDispatcher,
): DispatcherInternals {
  return dispatcher as unknown as DispatcherInternals;
}

function getDispatcherHandlers(
  dispatcher: OutboxDispatcher,
): DispatcherHandlers {
  return dispatcher as unknown as DispatcherHandlers;
}

/**
 * Infrastructure-neutral persistence used only for this composition test.
 *
 * The real CourseProjectionEventHandler remains in use.
 *
 * PostgreSQL Course catalog/search projection persistence is already
 * covered independently by the API integration suites. Keeping the
 * projection persistence adapter in-memory here prevents the Worker
 * integration suite from introducing an API-infrastructure dependency.
 */
class InMemoryCourseProjectionPersistence implements CourseProjectionPersistence {
  readonly state: InMemoryCourseProjectionState = {
    catalog: new Map<string, CourseCatalogProjection>(),
    search: new Map<string, CourseSearchProjection>(),
  };

  readonly catalog = {
    upsert: async (projection: CourseCatalogProjection): Promise<boolean> => {
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
}

/**
 * BullMQ serializes transport data.
 *
 * The Course domain event is reconstructed only at the test boundary
 * before invoking the real CourseProjectionEventHandler.
 *
 * This is intentionally a test-only boundary and does not weaken the
 * production CourseDomainEvent contract.
 */
function deserializeCourseDomainEvent(
  event: CourseOutboxQueueJobData['event'],
): CourseDomainEvent {
  return event as unknown as CourseDomainEvent;
}

/**
 * Narrows the CourseDomainEvent discriminated union to CourseCreatedEvent.
 *
 * This is important because CourseDomainEvent is a discriminated union:
 * TypeScript must know that eventName is CREATED before title,
 * description, or instructorId can be accessed.
 */
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

function createCourseCreatedEvent(
  courseId: string,
  occurredAt: Date,
): CourseDomainEvent {
  return createDomainEvent(
    CourseDomainEventName.CREATED,
    courseId,
    {
      courseId,
      title: `Phase 4.17-C Course ${courseId}`,
      description: 'Outbox to projection integration course.',
      level: CourseLevel.BEGINNER,
      type: CourseType.SELF_PACED,
      visibility: CourseVisibility.PUBLIC,
      status: CourseStatus.DRAFT,
      instructorId: `phase-4-17-c-instructor-${courseId}`,
    },
    occurredAt,
  );
}

function createMetadataUpdatedEvent(
  courseId: string,
  title: string,
  description: string,
  occurredAt: Date,
): CourseDomainEvent {
  return createDomainEvent(
    CourseDomainEventName.METADATA_UPDATED,
    courseId,
    {
      courseId,
      title,
      description,
      level: CourseLevel.BEGINNER,
      type: CourseType.SELF_PACED,
      visibility: CourseVisibility.PUBLIC,
    },
    occurredAt,
  );
}

/**
 * Prisma's JSON input contract is intentionally narrower than unknown.
 *
 * This helper represents the explicit persistence boundary in this
 * integration test.
 */
function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

/**
 * Converts a Course domain-event payload into the transport contract's
 * recursively JSON-compatible OutboxJsonValue representation.
 *
 * The Course domain payload interfaces intentionally do not expose a
 * string-index signature because they are strongly typed domain objects.
 * The Outbox transport contract is intentionally structural and requires
 * JSON-compatible object values. This helper performs that explicit
 * test-boundary conversion without weakening either production contract.
 */
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
  outboxEventId: string,
  dedupeKey: string,
): CourseOutboxDispatchEvent {
  return {
    id: outboxEventId,
    eventType: event.eventName,
    aggregateType: COURSE_OUTBOX_AGGREGATE_TYPE,
    aggregateId: event.aggregateId,
    dedupeKey,
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

/**
 * Creates a deterministic PROCESSING Outbox record representing an
 * event already claimed by the real dispatcher instance.
 *
 * The test intentionally starts at PROCESSING because dispatcher
 * claiming is already covered by the dedicated PostgreSQL dispatcher
 * integration suite. This suite focuses on the composition:
 *
 * PostgreSQL Outbox
 *      ↓
 * real dispatcher publish boundary
 *      ↓
 * BullMQ
 *      ↓
 * Course projection handler
 */
async function createProcessingOutboxRow(
  prisma: PrismaClient,
  event: CourseDomainEvent,
  outboxEventId: string,
  dedupeKey: string,
  lockedBy: string,
): Promise<void> {
  const now = new Date();

  await prisma.outboxEvent.create({
    data: {
      id: outboxEventId,
      eventType: event.eventName,
      aggregateType: COURSE_OUTBOX_AGGREGATE_TYPE,
      aggregateId: event.aggregateId,
      dedupeKey,
      payload: toPrismaJson(event),
      status: 'PROCESSING',
      attempts: 1,
      availableAt: now,
      lockedAt: now,
      lockedBy,
      lastAttemptAt: now,
      createdAt: now,
      updatedAt: now,
    },
  });
}

async function waitForProjection(
  state: InMemoryCourseProjectionState,
  courseId: string,
  timeoutMs = 10_000,
): Promise<{
  readonly catalog: CourseCatalogProjection;
  readonly search: CourseSearchProjection;
}> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const catalog = state.catalog.get(courseId);
    const search = state.search.get(courseId);

    if (catalog !== undefined && search !== undefined) {
      return {
        catalog,
        search,
      };
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 25);
    });
  }

  throw new Error(
    `Timed out waiting for Course projections for "${courseId}".`,
  );
}

async function waitForSearchProjection(
  state: InMemoryCourseProjectionState,
  courseId: string,
  timeoutMs = 10_000,
): Promise<CourseSearchProjection> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const search = state.search.get(courseId);

    if (search !== undefined) {
      return search;
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 25);
    });
  }

  throw new Error(
    `Timed out waiting for CourseSearch projection for "${courseId}".`,
  );
}

async function waitForOutboxStatus(
  prisma: PrismaClient,
  outboxEventId: string,
  status: 'PUBLISHED' | 'DEAD_LETTER',
  timeoutMs = 10_000,
): Promise<
  NonNullable<Awaited<ReturnType<PrismaClient['outboxEvent']['findUnique']>>>
> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const row = await prisma.outboxEvent.findUnique({
      where: {
        id: outboxEventId,
      },
    });

    if (row?.status === status) {
      return row;
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 25);
    });
  }

  throw new Error(
    `Timed out waiting for OutboxEvent "${outboxEventId}" to reach "${status}".`,
  );
}

async function closeDispatcher(dispatcher: OutboxDispatcher): Promise<void> {
  const handlers = getDispatcherHandlers(dispatcher);

  await handlers.courseDispatchHandler.close();
}

describeIntegration(
  'Course Outbox → Projection integration - PostgreSQL + Redis',
  () => {
    let prisma: PrismaClient;
    let dispatcher: OutboxDispatcher;

    let observerQueue: Queue<CourseOutboxQueueJobData>;
    let queueEvents: QueueEvents;
    let courseWorker: Worker<CourseOutboxQueueJobData>;

    /**
     * IMPORTANT:
     *
     * These objects are created exactly once in beforeAll.
     *
     * beforeEach only clears their state. It must NOT replace
     * projectionPersistence or projectionHandler because the real
     * BullMQ Worker closes over the handler created in beforeAll.
     */
    let projectionPersistence: InMemoryCourseProjectionPersistence;
    let projectionHandler: CourseProjectionEventHandler;

    const createdOutboxIds = new Set<string>();
    const createdJobIds = new Set<string>();

    beforeAll(async () => {
      prisma = createPrismaClient();

      await prisma.$connect();

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

      /**
       * Real BullMQ consumer boundary.
       *
       * The worker receives the actual transport payload produced by
       * the real Course Outbox dispatch handler and invokes the real
       * CourseProjectionEventHandler.
       */
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
        /**
         * BullMQ requires an error listener to prevent an unhandled
         * worker-level error.
         *
         * Individual job failures remain observable through
         * waitUntilFinished().
         */
        void error;
      });

      await observerQueue.waitUntilReady();
      await queueEvents.waitUntilReady();
      await courseWorker.waitUntilReady();

      dispatcher = new OutboxDispatcher(prisma, createLoggerMock() as never);
    });

    beforeEach(async () => {
      /**
       * Do not replace projectionPersistence here.
       *
       * The BullMQ Worker captures projectionHandler from beforeAll,
       * and projectionHandler captures projectionPersistence.
       *
       * Clearing the existing maps preserves the same live object graph.
       */
      projectionPersistence.state.catalog.clear();
      projectionPersistence.state.search.clear();

      if (createdOutboxIds.size > 0) {
        await prisma.outboxEvent.deleteMany({
          where: {
            id: {
              in: [...createdOutboxIds],
            },
          },
        });

        createdOutboxIds.clear();
      }

      if (createdJobIds.size > 0) {
        for (const jobId of createdJobIds) {
          const job = await observerQueue.getJob(jobId);

          if (job !== undefined) {
            await job.remove();
          }
        }

        createdJobIds.clear();
      }
    });

    afterAll(async () => {
      if (!prisma) {
        return;
      }

      if (createdOutboxIds.size > 0) {
        await prisma.outboxEvent.deleteMany({
          where: {
            id: {
              in: [...createdOutboxIds],
            },
          },
        });
      }

      if (createdJobIds.size > 0) {
        for (const jobId of createdJobIds) {
          const job = await observerQueue.getJob(jobId);

          if (job !== undefined) {
            await job.remove();
          }
        }
      }

      await courseWorker.close();
      await queueEvents.close();
      await observerQueue.close();
      await closeDispatcher(dispatcher);
      await prisma.$disconnect();
    });

    it('delivers a persisted CourseCreated Outbox event through the real dispatcher and projection consumer', async () => {
      const courseId = `phase-4-17-c-course-${randomUUID()}`;

      const eventId = randomUUID();

      const outboxEventId = `phase-4-17-c-outbox-${randomUUID()}`;

      const dedupeKey = `phase-4-17-c-event-${eventId}`;

      const occurredAt = new Date();

      const event = createCourseCreatedEvent(courseId, occurredAt);

      const createdEvent = expectCourseCreatedEvent(event);

      createdOutboxIds.add(outboxEventId);

      await createProcessingOutboxRow(
        prisma,
        event,
        outboxEventId,
        dedupeKey,
        getDispatcherInternals(dispatcher).instanceId,
      );

      const dispatchEvent = createOutboxDispatchEvent(
        event,
        outboxEventId,
        dedupeKey,
      );

      const jobId = `course-event-${event.eventId}`;

      createdJobIds.add(jobId);

      const existingJob = await observerQueue.getJob(jobId);

      if (existingJob !== undefined) {
        await existingJob.remove();
      }

      await getDispatcherInternals(dispatcher).publish(dispatchEvent);

      const job = await observerQueue.getJob(jobId);

      expect(job).toBeDefined();

      if (job === undefined) {
        throw new Error(`Expected BullMQ Course job "${jobId}" to exist.`);
      }

      await job.waitUntilFinished(queueEvents, 10_000);

      const persistedOutbox = await waitForOutboxStatus(
        prisma,
        outboxEventId,
        'PUBLISHED',
      );

      expect(persistedOutbox).toMatchObject({
        id: outboxEventId,
        aggregateType: COURSE_OUTBOX_AGGREGATE_TYPE,
        aggregateId: courseId,
        eventType: CourseDomainEventName.CREATED,
        status: 'PUBLISHED',
        attempts: 1,
      });

      expect(persistedOutbox.publishedAt).toBeInstanceOf(Date);

      const projections = await waitForProjection(
        projectionPersistence.state,
        courseId,
      );

      expect(projections.catalog).toMatchObject({
        courseId,
        title: createdEvent.payload.title,
        description: createdEvent.payload.description,
        level: createdEvent.payload.level,
        type: createdEvent.payload.type,
        visibility: createdEvent.payload.visibility,
        status: CourseStatus.DRAFT,
        instructorId: createdEvent.payload.instructorId,
      });

      expect(projections.catalog.updatedAt).toEqual(occurredAt);

      expect(projections.search).toMatchObject({
        courseId,
        title: createdEvent.payload.title,
        description: createdEvent.payload.description,
        level: createdEvent.payload.level,
        type: createdEvent.payload.type,
        visibility: createdEvent.payload.visibility,
        status: CourseStatus.DRAFT,
        instructorId: createdEvent.payload.instructorId,
      });

      expect(projections.search.searchText).toContain(
        createdEvent.payload.title,
      );

      expect(projections.search.searchText).toContain(
        createdEvent.payload.description,
      );
    });

    it('delivers a persisted metadata-update Outbox event through the real dispatcher after the CourseCreated projection exists', async () => {
      const courseId = `phase-4-17-c-course-${randomUUID()}`;

      const createdEventId = randomUUID();

      const createdOutboxEventId = `phase-4-17-c-outbox-${randomUUID()}`;

      const createdDedupeKey = `phase-4-17-c-event-${createdEventId}`;

      const createdAt = new Date(Date.now() - 2_000);

      const createdEvent = createCourseCreatedEvent(courseId, createdAt);

      const narrowedCreatedEvent = expectCourseCreatedEvent(createdEvent);

      createdOutboxIds.add(createdOutboxEventId);

      await createProcessingOutboxRow(
        prisma,
        createdEvent,
        createdOutboxEventId,
        createdDedupeKey,
        getDispatcherInternals(dispatcher).instanceId,
      );

      const createdDispatchEvent = createOutboxDispatchEvent(
        createdEvent,
        createdOutboxEventId,
        createdDedupeKey,
      );

      const createdJobId = `course-event-${createdEvent.eventId}`;

      createdJobIds.add(createdJobId);

      const existingCreatedJob = await observerQueue.getJob(createdJobId);

      if (existingCreatedJob !== undefined) {
        await existingCreatedJob.remove();
      }

      await getDispatcherInternals(dispatcher).publish(createdDispatchEvent);

      const createdJob = await observerQueue.getJob(createdJobId);

      expect(createdJob).toBeDefined();

      if (createdJob === undefined) {
        throw new Error(`Expected CourseCreated BullMQ job "${createdJobId}".`);
      }

      await createdJob.waitUntilFinished(queueEvents, 10_000);

      await waitForOutboxStatus(prisma, createdOutboxEventId, 'PUBLISHED');

      const createdProjection = await waitForProjection(
        projectionPersistence.state,
        courseId,
      );

      expect(createdProjection.catalog.title).toBe(
        narrowedCreatedEvent.payload.title,
      );

      const metadataEventId = randomUUID();

      const metadataOutboxEventId = `phase-4-17-c-outbox-${randomUUID()}`;

      const metadataDedupeKey = `phase-4-17-c-event-${metadataEventId}`;

      const metadataOccurredAt = new Date(Date.now() + 1_000);

      const updatedTitle = `Phase 4.17-C Updated ${courseId}`;

      const updatedDescription =
        'Updated through the Outbox projection boundary.';

      const metadataEvent = createMetadataUpdatedEvent(
        courseId,
        updatedTitle,
        updatedDescription,
        metadataOccurredAt,
      );

      createdOutboxIds.add(metadataOutboxEventId);

      await createProcessingOutboxRow(
        prisma,
        metadataEvent,
        metadataOutboxEventId,
        metadataDedupeKey,
        getDispatcherInternals(dispatcher).instanceId,
      );

      const metadataDispatchEvent = createOutboxDispatchEvent(
        metadataEvent,
        metadataOutboxEventId,
        metadataDedupeKey,
      );

      const metadataJobId = `course-event-${metadataEvent.eventId}`;

      createdJobIds.add(metadataJobId);

      const existingMetadataJob = await observerQueue.getJob(metadataJobId);

      if (existingMetadataJob !== undefined) {
        await existingMetadataJob.remove();
      }

      await getDispatcherInternals(dispatcher).publish(metadataDispatchEvent);

      const metadataJob = await observerQueue.getJob(metadataJobId);

      expect(metadataJob).toBeDefined();

      if (metadataJob === undefined) {
        throw new Error(`Expected metadata BullMQ job "${metadataJobId}".`);
      }

      await metadataJob.waitUntilFinished(queueEvents, 10_000);

      const updatedSearchProjection = await waitForSearchProjection(
        projectionPersistence.state,
        courseId,
      );

      expect(updatedSearchProjection.title).toBe(updatedTitle);

      expect(updatedSearchProjection.description).toBe(updatedDescription);

      expect(updatedSearchProjection.searchText).toContain(updatedTitle);

      expect(updatedSearchProjection.searchText).toContain(updatedDescription);

      expect(updatedSearchProjection.updatedAt).toEqual(metadataOccurredAt);

      const persistedMetadataOutbox = await waitForOutboxStatus(
        prisma,
        metadataOutboxEventId,
        'PUBLISHED',
      );

      expect(persistedMetadataOutbox).toMatchObject({
        id: metadataOutboxEventId,
        aggregateId: courseId,
        eventType: CourseDomainEventName.METADATA_UPDATED,
        status: 'PUBLISHED',
        attempts: 1,
      });
    });
  },
);
