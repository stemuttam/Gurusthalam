/**
 * Course Outbox Dispatch Handler
 *
 * This is the transport boundary after the PostgreSQL Outbox.
 *
 * Current D4 responsibility:
 *
 *   PostgreSQL Outbox
 *          ↓
 *   CourseOutboxDispatchHandler
 *          ↓
 *   BullMQ course-events queue
 *
 * D4 establishes:
 *
 * - deterministic Course transport identity;
 * - BullMQ execution retry configuration;
 * - transport-level idempotency;
 * - preservation of the original Course event envelope;
 * - explicit separation between Outbox retry and BullMQ retry.
 *
 * It deliberately does NOT:
 *
 * - execute Course business logic;
 * - mutate Course state;
 * - perform search indexing;
 * - generate embeddings;
 * - invoke AI;
 * - perform recommendation work;
 * - own PostgreSQL Outbox retry state;
 * - claim that downstream Course consumers are idempotent.
 *
 * Downstream consumer idempotency remains the responsibility of the
 * consumer boundary.
 */

import { Queue } from 'bullmq';

import { getRedisConfig } from '@gurusthalam/config';

import { QUEUE_NAMES, QUEUE_PREFIX } from '../queues/queue.constants.js';

import { getCourseOutboxRetryPolicy } from './course-outbox-retry.policy.js';

import {
  COURSE_OUTBOX_EVENT_TYPES,
  isCourseOutboxDispatchEvent,
  type CourseOutboxDispatchEvent,
  type CourseOutboxDispatchHandler,
  type CourseOutboxDomainEventEnvelope,
  type OutboxJsonValue,
} from './course-outbox-dispatch.contracts.js';

/**
 * JSON-compatible Course event payload placed onto BullMQ.
 *
 * The persisted domain-event envelope remains intact.
 *
 * `outboxEventId`, `dedupeKey`, and `aggregateId` are transport
 * metadata that allow a downstream consumer to correlate the BullMQ
 * job with the durable PostgreSQL Outbox record.
 */
export interface CourseOutboxQueueJobData {
  readonly outboxEventId: string;

  readonly dedupeKey: string;

  readonly aggregateId: string;

  readonly event: CourseOutboxQueueEventEnvelope;
}

/**
 * BullMQ cannot preserve JavaScript Date instances across its JSON
 * transport boundary.
 *
 * The Course queue therefore receives a canonical ISO timestamp.
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
 * Runtime shape used only for the pre-contract timestamp validation.
 *
 * The dispatch contract remains the authoritative validator for the
 * complete Course Outbox event.
 *
 * This type exists because JavaScript runtime data can be malformed
 * even when the TypeScript compile-time type is valid.
 */
type CourseOutboxRuntimeCandidate = {
  readonly payload?: {
    readonly occurredAt?: unknown;
  };
};

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
   * D4 guarantees:
   *
   * 1. deterministic transport identity;
   * 2. bounded BullMQ retry;
   * 3. complete event-envelope preservation.
   *
   * The durable eventId is used as the deterministic BullMQ job ID.
   *
   * BullMQ treats the same job ID as the same logical job identity.
   * Therefore repeated dispatch attempts cannot intentionally create
   * multiple logical Course jobs while the deterministic job remains
   * represented by BullMQ.
   *
   * This is transport-level idempotency.
   *
   * It must not be confused with downstream consumer idempotency.
   */
  async dispatch(event: CourseOutboxDispatchEvent): Promise<{
    readonly dispatched: boolean;

    readonly idempotent: boolean;
  }> {
    /*
     * Runtime data can violate the compile-time CourseOutboxDispatchEvent
     * type. Validate an explicitly supplied occurredAt before the
     * broader structural contract guard so an invalid timestamp receives
     * the precise diagnostic owned by this transport boundary.
     *
     * The structural Course dispatch contract remains authoritative for
     * every other field.
     */
    this.validateRuntimeTimestamp(event);

    if (!isCourseOutboxDispatchEvent(event)) {
      throw new Error('Invalid Course Outbox dispatch event.');
    }

    const queueEvent = this.toQueueEvent(event.payload);

    const retryPolicy = getCourseOutboxRetryPolicy();

    /*
     * The durable domain-event identity is the canonical transport
     * identity.
     *
     * The prefix prevents accidental collision with unrelated queue
     * jobs while keeping the identity deterministic.
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
        /*
         * D4 transport retry.
         *
         * This is deliberately independent from the PostgreSQL
         * Outbox retry counter.
         */
        attempts: retryPolicy.maxAttempts,

        backoff: {
          type: retryPolicy.backoffType,

          delay: retryPolicy.initialDelayMs,
        },

        /*
         * Deterministic transport identity.
         */
        jobId,

        /*
         * Keep a bounded operational history.
         *
         * PostgreSQL Outbox remains the durable source of truth.
         */
        removeOnComplete: 100,

        removeOnFail: 1000,
      },
    );

    return {
      dispatched: true,

      /*
       * The dispatch operation is idempotent at the transport
       * identity boundary because every publication uses the same
       * deterministic BullMQ job ID for the same durable event.
       *
       * This does NOT claim that downstream Course consumers are
       * already idempotent.
       */
      idempotent: true,
    };
  }

  /**
   * Close the underlying BullMQ queue during worker shutdown.
   */
  async close(): Promise<void> {
    await this.queue.close();
  }

  /**
   * Validate an explicitly supplied runtime timestamp before the
   * structural Course dispatch contract is evaluated.
   *
   * This method intentionally does not attempt to validate the entire
   * event. That responsibility remains with
   * `isCourseOutboxDispatchEvent()`.
   *
   * The purpose of this narrow check is to preserve the specific
   * occurredAt diagnostic when malformed runtime data reaches the
   * handler.
   */
  private validateRuntimeTimestamp(event: CourseOutboxDispatchEvent): void {
    const candidate = event as unknown as CourseOutboxRuntimeCandidate;

    const payload = candidate.payload;

    if (payload === null || typeof payload !== 'object') {
      return;
    }

    if (!Object.prototype.hasOwnProperty.call(payload, 'occurredAt')) {
      return;
    }

    const occurredAt = payload.occurredAt;

    if (occurredAt instanceof Date) {
      if (Number.isNaN(occurredAt.getTime())) {
        throw new Error('Course Outbox event occurredAt is invalid.');
      }

      return;
    }

    if (typeof occurredAt === 'string') {
      const timestamp = new Date(occurredAt);

      if (Number.isNaN(timestamp.getTime())) {
        throw new Error('Course Outbox event occurredAt is invalid.');
      }
    }
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

  /**
   * Normalize a persisted timestamp into the canonical ISO format
   * required by the BullMQ transport boundary.
   *
   * Invalid Date instances and invalid date strings are rejected
   * before queue publication.
   */
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
