import type { CourseLevel } from '../enums/course-level.js';
import type { CourseStatus } from '../enums/course-status.js';
import type { CourseType } from '../enums/course-type.js';
import type { CourseVisibility } from '../enums/course-visibility.js';
import type { DomainEvent } from './domain-event.js';

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

export interface CourseMetadataUpdatedPayload {
  readonly courseId: string;
  readonly title: string;
  readonly description: string | null;
  readonly level: CourseLevel;
  readonly type: CourseType;
  readonly visibility: CourseVisibility;
}

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

export type CourseDomainEvent =
  | CourseCreatedEvent
  | CourseMetadataUpdatedEvent
  | CourseSubmittedForReviewEvent
  | CoursePublishedEvent
  | CourseUnpublishedEvent
  | CourseArchivedEvent;