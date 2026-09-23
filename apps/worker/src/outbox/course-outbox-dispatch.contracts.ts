/**
 * Course Outbox Dispatch Contract
 *
 * This file defines the worker-side transport contract for dispatching
 * Course domain events that have already been durably persisted in the
 * PostgreSQL Outbox.
 *
 * Architectural boundary:
 *
 *   Course aggregate
 *        ↓
 *   CourseRepository
 *        ↓
 *   PostgreSQL transaction
 *        ↓
 *   OutboxEvent
 *        ↓
 *   Course dispatch contract
 *        ↓
 *   Course event routing / consumers
 *
 * This contract intentionally does NOT contain:
 * - Prisma types
 * - BullMQ types
 * - Redis types
 * - NestJS types
 * - HTTP types
 * - notification-specific payloads
 * - AI/ML implementation details
 */

export const COURSE_OUTBOX_AGGREGATE_TYPE = 'Course' as const;

export const COURSE_OUTBOX_EVENT_TYPES = {
  CREATED: 'courses.course.created',

  METADATA_UPDATED: 'courses.course.metadata_updated',

  SUBMITTED_FOR_REVIEW: 'courses.course.submitted_for_review',

  CHANGES_REQUESTED: 'courses.course.changes_requested',

  PUBLISHED: 'courses.course.published',

  UNPUBLISHED: 'courses.course.unpublished',

  ARCHIVED: 'courses.course.archived',
} as const;

export type CourseOutboxEventType =
  (typeof COURSE_OUTBOX_EVENT_TYPES)[keyof typeof COURSE_OUTBOX_EVENT_TYPES];

export type OutboxJsonPrimitive = string | number | boolean | null;

export type OutboxJsonValue =
  | OutboxJsonPrimitive
  | OutboxJsonValue[]
  | {
      readonly [key: string]: OutboxJsonValue;
    };

export interface CourseOutboxDomainEventEnvelope<
  TPayload extends OutboxJsonValue = OutboxJsonValue,
> {
  readonly eventId: string;

  readonly eventName: CourseOutboxEventType;

  readonly eventVersion: number;

  readonly aggregateId: string;

  readonly occurredAt: string | Date;

  readonly payload: TPayload;
}

export interface CourseOutboxDispatchEvent {
  readonly id: string;

  readonly eventType: CourseOutboxEventType;

  readonly aggregateType: typeof COURSE_OUTBOX_AGGREGATE_TYPE;

  readonly aggregateId: string;

  readonly dedupeKey: string;

  readonly payload: CourseOutboxDomainEventEnvelope;

  readonly attempts: number;
}

export interface CourseOutboxDispatchResult {
  readonly dispatched: boolean;

  readonly idempotent: boolean;
}

export interface CourseOutboxDispatchHandler {
  dispatch(
    event: CourseOutboxDispatchEvent,
  ): Promise<CourseOutboxDispatchResult>;
}

export function isCourseOutboxEventType(
  value: unknown,
): value is CourseOutboxEventType {
  return (
    value === COURSE_OUTBOX_EVENT_TYPES.CREATED ||
    value === COURSE_OUTBOX_EVENT_TYPES.METADATA_UPDATED ||
    value === COURSE_OUTBOX_EVENT_TYPES.SUBMITTED_FOR_REVIEW ||
    value === COURSE_OUTBOX_EVENT_TYPES.CHANGES_REQUESTED ||
    value === COURSE_OUTBOX_EVENT_TYPES.PUBLISHED ||
    value === COURSE_OUTBOX_EVENT_TYPES.UNPUBLISHED ||
    value === COURSE_OUTBOX_EVENT_TYPES.ARCHIVED
  );
}

export function isCourseOutboxAggregateType(
  value: unknown,
): value is typeof COURSE_OUTBOX_AGGREGATE_TYPE {
  return value === COURSE_OUTBOX_AGGREGATE_TYPE;
}

export function isCourseOutboxDispatchEvent(
  value: unknown,
): value is CourseOutboxDispatchEvent {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (typeof candidate.id !== 'string' || candidate.id.trim().length === 0) {
    return false;
  }

  if (!isCourseOutboxEventType(candidate.eventType)) {
    return false;
  }

  if (!isCourseOutboxAggregateType(candidate.aggregateType)) {
    return false;
  }

  if (
    typeof candidate.aggregateId !== 'string' ||
    candidate.aggregateId.trim().length === 0
  ) {
    return false;
  }

  if (
    typeof candidate.dedupeKey !== 'string' ||
    candidate.dedupeKey.trim().length === 0
  ) {
    return false;
  }

  if (
    typeof candidate.attempts !== 'number' ||
    !Number.isInteger(candidate.attempts) ||
    candidate.attempts < 0
  ) {
    return false;
  }

  if (!isCourseOutboxDomainEventEnvelope(candidate.payload)) {
    return false;
  }

  /*
   * D3 hardening:
   *
   * The routing metadata stored in the Outbox row must agree with the
   * identity embedded inside the original domain-event envelope.
   *
   * This prevents a malformed or corrupted Outbox record from being
   * routed using one event identity while carrying another event.
   */
  if (candidate.payload.eventName !== candidate.eventType) {
    return false;
  }

  if (candidate.payload.aggregateId !== candidate.aggregateId) {
    return false;
  }

  return true;
}

export function isCourseOutboxDomainEventEnvelope(
  value: unknown,
): value is CourseOutboxDomainEventEnvelope {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.eventId !== 'string' ||
    candidate.eventId.trim().length === 0
  ) {
    return false;
  }

  if (!isCourseOutboxEventType(candidate.eventName)) {
    return false;
  }

  if (
    typeof candidate.eventVersion !== 'number' ||
    !Number.isInteger(candidate.eventVersion) ||
    candidate.eventVersion < 1
  ) {
    return false;
  }

  if (
    typeof candidate.aggregateId !== 'string' ||
    candidate.aggregateId.trim().length === 0
  ) {
    return false;
  }

  if (!isValidOccurredAt(candidate.occurredAt)) {
    return false;
  }

  return isOutboxJsonValue(candidate.payload);
}

function isValidOccurredAt(value: unknown): value is string | Date {
  if (value instanceof Date) {
    return !Number.isNaN(value.getTime());
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    return false;
  }

  return !Number.isNaN(Date.parse(value));
}

function isOutboxJsonValue(value: unknown): value is OutboxJsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((item) => isOutboxJsonValue(item));
  }

  if (typeof value === 'object' && value !== null) {
    return Object.values(value as Record<string, unknown>).every((item) =>
      isOutboxJsonValue(item),
    );
  }

  return false;
}
