import type { CourseLevel } from '../enums/course-level.js';
import type { CourseStatus } from '../enums/course-status.js';
import type { CourseType } from '../enums/course-type.js';
import type { CourseVisibility } from '../enums/course-visibility.js';
import { createDomainEvent, type DomainEvent } from './domain-event.js';

/**
 * Canonical domain-event names owned by the Course aggregate.
 *
 * These names are stable integration contracts. Consumers should depend on
 * these constants rather than duplicating string literals.
 */
export const CourseDomainEventName = {
  CREATED: 'courses.course.created',
  METADATA_UPDATED: 'courses.course.metadata_updated',
  SUBMITTED_FOR_REVIEW: 'courses.course.submitted_for_review',
  PUBLISHED: 'courses.course.published',
  UNPUBLISHED: 'courses.course.unpublished',
  ARCHIVED: 'courses.course.archived',
} as const;

export type CourseDomainEventName =
  (typeof CourseDomainEventName)[keyof typeof CourseDomainEventName];

/**
 * Payload emitted when a Course aggregate is created.
 */
export interface CourseCreatedPayload {
  readonly courseId: string;
  readonly title: string;
  readonly description: string | null;
  readonly level: CourseLevel;
  readonly type: CourseType;
  readonly visibility: CourseVisibility;
  readonly status: CourseStatus;
  readonly instructorId: string;
}

/**
 * Payload emitted when Course metadata is updated.
 *
 * This contract intentionally contains only transactional Course metadata.
 * Search indexes, embeddings, recommendation signals, AI model metadata,
 * vector identifiers, and other intelligence artifacts belong to later
 * application/integration infrastructure.
 */
export interface CourseMetadataUpdatedPayload {
  readonly courseId: string;
  readonly title: string;
  readonly description: string | null;
  readonly level: CourseLevel;
  readonly type: CourseType;
  readonly visibility: CourseVisibility;
}

/**
 * Payload emitted when the Course lifecycle status changes.
 */
export interface CourseStatusChangedPayload {
  readonly courseId: string;
  readonly previousStatus: CourseStatus;
  readonly currentStatus: CourseStatus;
}

export type CourseCreatedEvent = DomainEvent<
  typeof CourseDomainEventName.CREATED,
  CourseCreatedPayload
>;

export type CourseMetadataUpdatedEvent = DomainEvent<
  typeof CourseDomainEventName.METADATA_UPDATED,
  CourseMetadataUpdatedPayload
>;

/**
 * Creates the canonical CourseMetadataUpdated domain event.
 *
 * The generic domain-event factory remains responsible for:
 * - event identity
 * - event version
 * - timestamp isolation
 * - payload cloning
 *
 * This specialized factory establishes the Course metadata event contract
 * without introducing a second event-envelope implementation.
 */
export function createCourseMetadataUpdatedEvent(
  aggregateId: string,
  payload: CourseMetadataUpdatedPayload,
  occurredAt: Date = new Date(),
): CourseMetadataUpdatedEvent {
  return createDomainEvent(
    CourseDomainEventName.METADATA_UPDATED,
    aggregateId,
    payload,
    occurredAt,
  );
}

export type CourseSubmittedForReviewEvent = DomainEvent<
  typeof CourseDomainEventName.SUBMITTED_FOR_REVIEW,
  CourseStatusChangedPayload
>;

export type CoursePublishedEvent = DomainEvent<
  typeof CourseDomainEventName.PUBLISHED,
  CourseStatusChangedPayload
>;

export type CourseUnpublishedEvent = DomainEvent<
  typeof CourseDomainEventName.UNPUBLISHED,
  CourseStatusChangedPayload
>;

export type CourseArchivedEvent = DomainEvent<
  typeof CourseDomainEventName.ARCHIVED,
  CourseStatusChangedPayload
>;

/**
 * Complete discriminated union of Course aggregate domain events.
 */
export type CourseDomainEvent =
  | CourseCreatedEvent
  | CourseMetadataUpdatedEvent
  | CourseSubmittedForReviewEvent
  | CoursePublishedEvent
  | CourseUnpublishedEvent
  | CourseArchivedEvent;
