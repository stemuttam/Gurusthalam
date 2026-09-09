export {
  createDomainEvent,
  type DomainEvent,
} from './domain-event.js';

export {
  CourseDomainEventName,
  createCourseMetadataUpdatedEvent,
} from './course.events.js';

export type {
  CourseArchivedEvent,
  CourseCreatedEvent,
  CourseCreatedPayload,
  CourseDomainEvent,
  CourseMetadataUpdatedEvent,
  CourseMetadataUpdatedPayload,
  CoursePublishedEvent,
  CourseStatusChangedPayload,
  CourseSubmittedForReviewEvent,
  CourseUnpublishedEvent,
  CourseDomainEventName as CourseDomainEventNameType,
} from './course.events.js';
