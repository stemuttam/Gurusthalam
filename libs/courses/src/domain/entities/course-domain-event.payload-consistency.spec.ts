import { describe, expect, it } from 'vitest';
import { Course } from './course.js';
import { CourseLevel } from '../enums/course-level.js';
import { CourseStatus } from '../enums/course-status.js';
import { CourseType } from '../enums/course-type.js';
import { CourseVisibility } from '../enums/course-visibility.js';
import {
  CourseDomainEventName,
  type CourseCreatedEvent,
  type CourseDomainEvent,
  type CourseMetadataUpdatedEvent,
  type CourseStatusChangedPayload,
} from '../events/course.events.js';

const createCourse = (): Course =>
  Course.create({
    title: 'TypeScript Fundamentals',
    description: 'Learn TypeScript from the ground up.',
    level: CourseLevel.BEGINNER,
    type: CourseType.SELF_PACED,
    visibility: CourseVisibility.PRIVATE,
    instructorId: 'instructor-123',
  });

const getEvents = (course: Course): readonly CourseDomainEvent[] =>
  course.getDomainEvents();

const getEventAt = (
  course: Course,
  index: number,
): CourseDomainEvent => {
  const event = getEvents(course)[index];

  expect.assert(event);

  return event;
};

const getCreatedEvent = (course: Course): CourseCreatedEvent => {
  const event = getEventAt(course, 0);

  if (event.eventName !== CourseDomainEventName.CREATED) {
    throw new Error(
      `Expected CREATED event at index 0, received "${event.eventName}".`,
    );
  }

  return event;
};

const getMetadataUpdatedEvent = (
  course: Course,
  index = 1,
): CourseMetadataUpdatedEvent => {
  const event = getEventAt(course, index);

  if (event.eventName !== CourseDomainEventName.METADATA_UPDATED) {
    throw new Error(
      `Expected METADATA_UPDATED event at index ${index}, received "${event.eventName}".`,
    );
  }

  return event;
};

const getSubmittedForReviewEvent = (
  course: Course,
  index: number,
): Extract<
  CourseDomainEvent,
  { eventName: typeof CourseDomainEventName.SUBMITTED_FOR_REVIEW }
> => {
  const event = getEventAt(course, index);

  if (
    event.eventName !== CourseDomainEventName.SUBMITTED_FOR_REVIEW
  ) {
    throw new Error(
      `Expected SUBMITTED_FOR_REVIEW event at index ${index}, received "${event.eventName}".`,
    );
  }

  return event;
};

const getPublishedEvent = (
  course: Course,
  index: number,
): Extract<
  CourseDomainEvent,
  { eventName: typeof CourseDomainEventName.PUBLISHED }
> => {
  const event = getEventAt(course, index);

  if (event.eventName !== CourseDomainEventName.PUBLISHED) {
    throw new Error(
      `Expected PUBLISHED event at index ${index}, received "${event.eventName}".`,
    );
  }

  return event;
};

const getUnpublishedEvent = (
  course: Course,
  index: number,
): Extract<
  CourseDomainEvent,
  { eventName: typeof CourseDomainEventName.UNPUBLISHED }
> => {
  const event = getEventAt(course, index);

  if (event.eventName !== CourseDomainEventName.UNPUBLISHED) {
    throw new Error(
      `Expected UNPUBLISHED event at index ${index}, received "${event.eventName}".`,
    );
  }

  return event;
};

const getArchivedEvent = (
  course: Course,
  index: number,
): Extract<
  CourseDomainEvent,
  { eventName: typeof CourseDomainEventName.ARCHIVED }
> => {
  const event = getEventAt(course, index);

  if (event.eventName !== CourseDomainEventName.ARCHIVED) {
    throw new Error(
      `Expected ARCHIVED event at index ${index}, received "${event.eventName}".`,
    );
  }

  return event;
};

const expectStatusPayload = (
  payload: CourseStatusChangedPayload,
  expectedPreviousStatus: CourseStatus,
  expectedCurrentStatus: CourseStatus,
  expectedCourseId: string,
): void => {
  expect(payload.courseId).toBe(expectedCourseId);
  expect(payload.previousStatus).toBe(expectedPreviousStatus);
  expect(payload.currentStatus).toBe(expectedCurrentStatus);
};

describe('Course domain-event payload consistency', () => {
  describe('CREATED payload', () => {
    it('contains the aggregate identity', () => {
      const course = createCourse();
      const event = getCreatedEvent(course);

      expect(event.aggregateId).toBe(course.id.toString());
      expect(event.payload.courseId).toBe(course.id.toString());
    });

    it('contains the initial course metadata', () => {
      const course = createCourse();
      const event = getCreatedEvent(course);

      expect(event.payload.title).toBe(course.title);
      expect(event.payload.description).toBe(course.description);
      expect(event.payload.level).toBe(course.level);
      expect(event.payload.type).toBe(course.type);
      expect(event.payload.visibility).toBe(course.visibility);
    });

    it('contains the initial status and instructor identity', () => {
      const course = createCourse();
      const event = getCreatedEvent(course);

      expect(event.payload.status).toBe(CourseStatus.DRAFT);
      expect(event.payload.status).toBe(course.status);
      expect(event.payload.instructorId).toBe(course.instructorId);
    });

    it('contains the complete CREATED payload contract', () => {
      const course = createCourse();
      const event = getCreatedEvent(course);

      expect(event.payload).toEqual({
        courseId: course.id.toString(),
        title: course.title,
        description: course.description,
        level: course.level,
        type: course.type,
        visibility: course.visibility,
        status: CourseStatus.DRAFT,
        instructorId: course.instructorId,
      });
    });
  });

  describe('METADATA_UPDATED payload', () => {
    it('contains the aggregate identity', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Advanced TypeScript',
      });

      const event = getMetadataUpdatedEvent(course);

      expect(event.aggregateId).toBe(course.id.toString());
      expect(event.payload.courseId).toBe(course.id.toString());
    });

    it('contains the updated metadata', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Advanced TypeScript',
        description: 'Advanced TypeScript course.',
        level: CourseLevel.INTERMEDIATE,
        type: CourseType.LIVE,
        visibility: CourseVisibility.PUBLIC,
      });

      const event = getMetadataUpdatedEvent(course);

      expect(event.payload.title).toBe('Advanced TypeScript');
      expect(event.payload.description).toBe(
        'Advanced TypeScript course.',
      );
      expect(event.payload.level).toBe(CourseLevel.INTERMEDIATE);
      expect(event.payload.type).toBe(CourseType.LIVE);
      expect(event.payload.visibility).toBe(CourseVisibility.PUBLIC);
    });

    it('contains the complete METADATA_UPDATED payload contract', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Advanced TypeScript',
        description: 'Advanced TypeScript course.',
        level: CourseLevel.INTERMEDIATE,
        type: CourseType.BLENDED,
        visibility: CourseVisibility.PUBLIC,
      });

      const event = getMetadataUpdatedEvent(course);

      expect(event.payload).toEqual({
        courseId: course.id.toString(),
        title: 'Advanced TypeScript',
        description: 'Advanced TypeScript course.',
        level: CourseLevel.INTERMEDIATE,
        type: CourseType.BLENDED,
        visibility: CourseVisibility.PUBLIC,
      });
    });

    it('does not include instructorId in the metadata payload', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Advanced TypeScript',
      });

      const event = getMetadataUpdatedEvent(course);

      expect('instructorId' in event.payload).toBe(false);
    });

    it('does not include status in the metadata payload', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Advanced TypeScript',
      });

      const event = getMetadataUpdatedEvent(course);

      expect('status' in event.payload).toBe(false);
    });
  });

  describe('SUBMITTED_FOR_REVIEW payload', () => {
    it('contains the aggregate identity', () => {
      const course = createCourse();

      course.submitForReview();

      const event = getSubmittedForReviewEvent(course, 1);

      expect(event.aggregateId).toBe(course.id.toString());
      expect(event.payload.courseId).toBe(course.id.toString());
    });

    it('contains the correct status transition', () => {
      const course = createCourse();

      course.submitForReview();

      const event = getSubmittedForReviewEvent(course, 1);

      expectStatusPayload(
        event.payload,
        CourseStatus.DRAFT,
        CourseStatus.IN_REVIEW,
        course.id.toString(),
      );
    });
  });

  describe('PUBLISHED payload', () => {
    it('contains the aggregate identity', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();

      const event = getPublishedEvent(course, 2);

      expect(event.aggregateId).toBe(course.id.toString());
      expect(event.payload.courseId).toBe(course.id.toString());
    });

    it('contains the correct status transition', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();

      const event = getPublishedEvent(course, 2);

      expectStatusPayload(
        event.payload,
        CourseStatus.IN_REVIEW,
        CourseStatus.PUBLISHED,
        course.id.toString(),
      );
    });
  });

  describe('UNPUBLISHED payload', () => {
    it('contains the aggregate identity', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();
      course.unpublish();

      const event = getUnpublishedEvent(course, 3);

      expect(event.aggregateId).toBe(course.id.toString());
      expect(event.payload.courseId).toBe(course.id.toString());
    });

    it('contains the correct status transition', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();
      course.unpublish();

      const event = getUnpublishedEvent(course, 3);

      expectStatusPayload(
        event.payload,
        CourseStatus.PUBLISHED,
        CourseStatus.UNPUBLISHED,
        course.id.toString(),
      );
    });
  });

  describe('ARCHIVED payload', () => {
    it('contains the aggregate identity', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      const event = getArchivedEvent(course, 4);

      expect(event.aggregateId).toBe(course.id.toString());
      expect(event.payload.courseId).toBe(course.id.toString());
    });

    it('contains the correct status transition', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      const event = getArchivedEvent(course, 4);

      expectStatusPayload(
        event.payload,
        CourseStatus.UNPUBLISHED,
        CourseStatus.ARCHIVED,
        course.id.toString(),
      );
    });
  });

  describe('aggregate identity consistency', () => {
    it('keeps aggregateId and payload.courseId identical for every event', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Advanced TypeScript',
      });

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      for (const event of getEvents(course)) {
        expect(event.aggregateId).toBe(course.id.toString());
        expect(event.payload.courseId).toBe(course.id.toString());
      }
    });

    it('uses primitive string identity in the event contract', () => {
      const course = createCourse();
      const event = getCreatedEvent(course);

      expect(typeof event.aggregateId).toBe('string');
      expect(typeof event.payload.courseId).toBe('string');
      expect(event.payload.courseId).toBe(course.id.toString());
    });
  });

  describe('payload isolation', () => {
    it('protects the stored CREATED payload from external mutation', () => {
      const course = createCourse();

      const firstEvent = getCreatedEvent(course);

      Reflect.set(firstEvent.payload, 'title', 'Externally mutated');

      const secondEvent = getCreatedEvent(course);

      expect(secondEvent.payload.title).toBe(
        'TypeScript Fundamentals',
      );
      expect(course.title).toBe('TypeScript Fundamentals');
    });

    it('protects the stored metadata payload from external mutation', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Advanced TypeScript',
      });

      const firstEvent = getMetadataUpdatedEvent(course);

      Reflect.set(firstEvent.payload, 'title', 'Externally mutated');

      const secondEvent = getMetadataUpdatedEvent(course);

      expect(secondEvent.payload.title).toBe(
        'Advanced TypeScript',
      );
      expect(course.title).toBe('Advanced TypeScript');
    });

    it('keeps separate metadata payloads independent', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Advanced TypeScript',
      });

      course.updateMetadata({
        title: 'Expert TypeScript',
      });

      const firstEvent = getMetadataUpdatedEvent(course, 1);
      const secondEvent = getMetadataUpdatedEvent(course, 2);

      expect(firstEvent.payload.title).toBe(
        'Advanced TypeScript',
      );
      expect(secondEvent.payload.title).toBe(
        'Expert TypeScript',
      );
      expect(firstEvent.payload).not.toBe(secondEvent.payload);
    });

    it('preserves earlier payloads after later lifecycle changes', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Advanced TypeScript',
      });

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      const metadataEvent = getMetadataUpdatedEvent(course);

      expect(metadataEvent.payload.title).toBe(
        'Advanced TypeScript',
      );
      expect(metadataEvent.payload.description).toBe(
        'Learn TypeScript from the ground up.',
      );
    });
  });

  describe('complete lifecycle payload consistency', () => {
    it('preserves the correct payload contract for every lifecycle event', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Advanced TypeScript',
        description: 'Advanced TypeScript course.',
        level: CourseLevel.INTERMEDIATE,
        type: CourseType.LIVE,
        visibility: CourseVisibility.PUBLIC,
      });

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      const events = getEvents(course);

      expect(events).toHaveLength(6);

      const created = getCreatedEvent(course);

      const metadataUpdated = getMetadataUpdatedEvent(
        course,
        1,
      );

      const submitted = getSubmittedForReviewEvent(
        course,
        2,
      );

      const published = getPublishedEvent(course, 3);

      const unpublished = getUnpublishedEvent(
        course,
        4,
      );

      const archived = getArchivedEvent(course, 5);

      expect(created.payload).toEqual({
        courseId: course.id.toString(),
        title: 'TypeScript Fundamentals',
        description: 'Learn TypeScript from the ground up.',
        level: CourseLevel.BEGINNER,
        type: CourseType.SELF_PACED,
        visibility: CourseVisibility.PRIVATE,
        status: CourseStatus.DRAFT,
        instructorId: course.instructorId,
      });

      expect(metadataUpdated.payload).toEqual({
        courseId: course.id.toString(),
        title: 'Advanced TypeScript',
        description: 'Advanced TypeScript course.',
        level: CourseLevel.INTERMEDIATE,
        type: CourseType.LIVE,
        visibility: CourseVisibility.PUBLIC,
      });

      expectStatusPayload(
        submitted.payload,
        CourseStatus.DRAFT,
        CourseStatus.IN_REVIEW,
        course.id.toString(),
      );

      expectStatusPayload(
        published.payload,
        CourseStatus.IN_REVIEW,
        CourseStatus.PUBLISHED,
        course.id.toString(),
      );

      expectStatusPayload(
        unpublished.payload,
        CourseStatus.PUBLISHED,
        CourseStatus.UNPUBLISHED,
        course.id.toString(),
      );

      expectStatusPayload(
        archived.payload,
        CourseStatus.UNPUBLISHED,
        CourseStatus.ARCHIVED,
        course.id.toString(),
      );
    });
  });
});