/**
 * Course Outbox Dispatch Handler
 *
 * This is the first transport boundary after the PostgreSQL Outbox.
 *
 * Current D3 responsibility:
 *
 *   PostgreSQL Outbox
 *          ↓
 *   CourseOutboxDispatchHandler
 *          ↓
 *   BullMQ course-events queue
 *
 * It deliberately does NOT:
 * - execute Course business logic;
 * - mutate Course state;
 * - perform search indexing;
 * - generate embeddings;
 * - invoke AI;
 * - perform recommendation work;
 * - own Outbox retry state;
 * - implement downstream consumer idempotency.
 *
 * Those concerns belong to later boundaries.
 */

import { Queue } from 'bullmq';

import { getRedisConfig } from '@gurusthalam/config';

import {
  COURSE_OUTBOX_EVENT_TYPES,
  isCourseOutboxDispatchEvent,
  type CourseOutboxDispatchEvent,
  type CourseOutboxDispatchHandler,
  type CourseOutboxDomainEventEnvelope,
  type OutboxJsonValue,
} from './course-outbox-dispatch.contracts.js';

import { QUEUE_NAMES, QUEUE_PREFIX } from '../queues/queue.constants.js';

/**
 * JSON-compatible Course event payload placed onto BullMQ.
 *
 * The original persisted domain-event envelope remains intact.
 *
 * `outboxEventId` and `dedupeKey` are transport metadata. They allow
 * a later consumer boundary to correlate the BullMQ job with the
 * durable Outbox record without reconstructing the original event.
 */
export interface CourseOutboxQueueJobData {
  readonly outboxEventId: string;

  readonly dedupeKey: string;

  readonly aggregateId: string;

  readonly event: CourseOutboxQueueEventEnvelope;
}

/**
 * BullMQ cannot preserve JavaScript Date instances across its JSON
 * transport boundary. The Course queue therefore receives the
 * canonical serialized timestamp representation.
 */
export interface CourseOutboxQueueEventEnvelope {
  readonly eventId: string;

  readonly eventName: CourseOutboxQueueEventEnvelopeName;

  readonly eventVersion: number;

  readonly aggregateId: string;

  readonly occurredAt: string;

  readonly payload: OutboxJsonValue;
}

type CourseOutboxQueueEventEnvelopeName = CourseOutboxQueueJobEventType;

type CourseOutboxQueueJobEventType =
  (typeof COURSE_OUTBOX_EVENT_TYPES)[keyof typeof COURSE_OUTBOX_EVENT_TYPES];

/**
 * Concrete BullMQ-backed Course Outbox dispatch handler.
 */
export class BullMqCourseOutboxDispatchHandler implements CourseOutboxDispatchHandler {
  constructor(private readonly queue: Queue<CourseOutboxQueueJobData>) {}

  /**
   * Construct the production Course event queue from the shared
   * Redis configuration.
   */
  static fromRedisConfig(): BullMqCourseOutboxDispatchHandler {
    const redis = getRedisConfig();

    const queue = new Queue<CourseOutboxQueueJobData>(
      QUEUE_NAMES.COURSE_EVENTS,
      {
        connection: {
          url: redis.url,
        },

        prefix: QUEUE_PREFIX,
      },
    );

    return new BullMqCourseOutboxDispatchHandler(queue);
  }

  /**
   * Dispatch one Course Outbox event to the Course event queue.
   *
   * The event identity is preserved exactly:
   *
   *   eventId
   *   eventName
   *   eventVersion
   *   aggregateId
   *   occurredAt
   *   payload
   *
   * The BullMQ job ID uses the durable eventId and a safe prefix.
   */
  async dispatch(event: CourseOutboxDispatchEvent): Promise<{
    readonly dispatched: boolean;

    readonly idempotent: boolean;
  }> {
    if (!isCourseOutboxDispatchEvent(event)) {
      throw new Error('Invalid Course Outbox dispatch event.');
    }

    const queueEvent = this.toQueueEvent(event.payload);

    /*
     * BullMQ custom job IDs must not contain ':' and must not be
     * purely numeric. The eventId is therefore namespaced with a
     * hyphenated prefix.
     *
     * D4 will establish the full downstream idempotency contract.
     */
    const jobId = `course-event-${event.payload.eventId}`;

    await this.queue.add(
      event.eventType,
      {
        outboxEventId: event.id,

        dedupeKey: event.dedupeKey,

        aggregateId: event.aggregateId,

        event: queueEvent,
      },
      {
        jobId,

        /*
         * Keep a bounded operational history. This is not the
         * durable event history; PostgreSQL Outbox remains that
         * source of truth.
         */
        removeOnComplete: 100,

        removeOnFail: 1000,
      },
    );

    return {
      dispatched: true,

      /*
       * D3 only establishes transport routing. Consumer-side
       * idempotency is intentionally deferred to D4.
       */
      idempotent: false,
    };
  }

  /**
   * Close the underlying BullMQ queue during worker shutdown.
   */
  async close(): Promise<void> {
    await this.queue.close();
  }

  /**
   * Convert the persisted Course event envelope into a JSON-safe
   * BullMQ transport representation.
   */
  private toQueueEvent(
    event: CourseOutboxDomainEventEnvelope,
  ): CourseOutboxQueueEventEnvelope {
    return {
      eventId: event.eventId,

      eventName: event.eventName,

      eventVersion: event.eventVersion,

      aggregateId: event.aggregateId,

      occurredAt: this.toIsoTimestamp(event.occurredAt),

      payload: structuredClone(event.payload),
    };
  }

  private toIsoTimestamp(value: string | Date): string {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        throw new Error('Course Outbox event occurredAt is invalid.');
      }

      return value.toISOString();
    }

    const timestamp = new Date(value);

    if (Number.isNaN(timestamp.getTime())) {
      throw new Error('Course Outbox event occurredAt is invalid.');
    }

    return timestamp.toISOString();
  }
}
