import { describe, expect, it } from 'vitest';

import { Course } from './course.js';
import {
  CourseDomainEventName,
  type CourseCreatedEvent,
  type CourseDomainEvent,
  type CourseMetadataUpdatedEvent,
  type CoursePublishedEvent,
  type CourseSubmittedForReviewEvent,
  type CourseUnpublishedEvent,
  type CourseArchivedEvent,
} from '../events/course.events.js';
import { CourseLevel } from '../enums/course-level.js';
import { CourseType } from '../enums/course-type.js';
import { CourseVisibility } from '../enums/course-visibility.js';

function createCourse(): Course {
  return Course.create({
    title: 'Draining Test Course',
    description: 'Original draining test description',
    level: CourseLevel.BEGINNER,
    type: CourseType.SELF_PACED,
    visibility: CourseVisibility.PRIVATE,
    instructorId: 'instructor-draining-test',
  });
}

function createCourseWithMetadataEvent(): Course {
  const course = createCourse();

  course.updateMetadata({
    title: 'Updated Draining Course',
    description: 'Updated draining description',
    visibility: CourseVisibility.PUBLIC,
  });

  return course;
}

function createPublishedCourse(): Course {
  const course = createCourseWithMetadataEvent();

  course.submitForReview();
  course.publish();

  return course;
}

function getEventAt(
  events: readonly CourseDomainEvent[],
  index: number,
): CourseDomainEvent {
  const event = events[index];

  expect.assert(event);

  return event;
}

function getCreatedEvent(
  events: readonly CourseDomainEvent[],
  index = 0,
): CourseCreatedEvent {
  const event = getEventAt(events, index);

  if (event.eventName !== CourseDomainEventName.CREATED) {
    throw new Error(
      `Expected CREATED event but received ${event.eventName}`,
    );
  }

  return event;
}

function getMetadataUpdatedEvent(
  events: readonly CourseDomainEvent[],
  index = 1,
): CourseMetadataUpdatedEvent {
  const event = getEventAt(events, index);

  if (event.eventName !== CourseDomainEventName.METADATA_UPDATED) {
    throw new Error(
      `Expected METADATA_UPDATED event but received ${event.eventName}`,
    );
  }

  return event;
}

function getSubmittedForReviewEvent(
  events: readonly CourseDomainEvent[],
  index: number,
): CourseSubmittedForReviewEvent {
  const event = getEventAt(events, index);

  if (event.eventName !== CourseDomainEventName.SUBMITTED_FOR_REVIEW) {
    throw new Error(
      `Expected SUBMITTED_FOR_REVIEW event but received ${event.eventName}`,
    );
  }

  return event;
}

function getPublishedEvent(
  events: readonly CourseDomainEvent[],
  index: number,
): CoursePublishedEvent {
  const event = getEventAt(events, index);

  if (event.eventName !== CourseDomainEventName.PUBLISHED) {
    throw new Error(
      `Expected PUBLISHED event but received ${event.eventName}`,
    );
  }

  return event;
}

function getUnpublishedEvent(
  events: readonly CourseDomainEvent[],
  index: number,
): CourseUnpublishedEvent {
  const event = getEventAt(events, index);

  if (event.eventName !== CourseDomainEventName.UNPUBLISHED) {
    throw new Error(
      `Expected UNPUBLISHED event but received ${event.eventName}`,
    );
  }

  return event;
}

function getArchivedEvent(
  events: readonly CourseDomainEvent[],
  index: number,
): CourseArchivedEvent {
  const event = getEventAt(events, index);

  if (event.eventName !== CourseDomainEventName.ARCHIVED) {
    throw new Error(
      `Expected ARCHIVED event but received ${event.eventName}`,
    );
  }

  return event;
}

describe('Course domain-event draining semantics', () => {
  describe('basic draining behavior', () => {
    it('returns all currently pending events', () => {
      const course = createCourse();

      const events = course.pullDomainEvents();

      expect(events).toHaveLength(1);
      expect(getCreatedEvent(events).eventName).toBe(
        CourseDomainEventName.CREATED,
      );
    });

    it('returns events in their original order', () => {
      const course = createCourseWithMetadataEvent();

      const events = course.pullDomainEvents();

      expect(events).toHaveLength(2);
      expect(getCreatedEvent(events, 0).eventName).toBe(
        CourseDomainEventName.CREATED,
      );
      expect(getMetadataUpdatedEvent(events, 1).eventName).toBe(
        CourseDomainEventName.METADATA_UPDATED,
      );
    });

    it('returns an empty collection after all events have been drained', () => {
      const course = createCourse();

      const firstPull = course.pullDomainEvents();
      const secondPull = course.pullDomainEvents();

      expect(firstPull).toHaveLength(1);
      expect(secondPull).toHaveLength(0);
    });

    it('does not retain drained events internally', () => {
      const course = createCourseWithMetadataEvent();

      const drainedEvents = course.pullDomainEvents();

      expect(drainedEvents).toHaveLength(2);
      expect(course.getDomainEvents()).toHaveLength(0);
      expect(course.pullDomainEvents()).toHaveLength(0);
    });

    it('returns a new empty collection on repeated empty pulls', () => {
      const course = createCourse();

      course.pullDomainEvents();

      const firstEmptyPull = course.pullDomainEvents();
      const secondEmptyPull = course.pullDomainEvents();

      expect(firstEmptyPull).not.toBe(secondEmptyPull);
      expect(firstEmptyPull).toEqual([]);
      expect(secondEmptyPull).toEqual([]);
    });
  });

  describe('draining after multiple domain transitions', () => {
    it('drains the complete publication lifecycle in order', () => {
      const course = createPublishedCourse();

      const events = course.pullDomainEvents();

      expect(events).toHaveLength(4);

      expect(getCreatedEvent(events, 0).eventName).toBe(
        CourseDomainEventName.CREATED,
      );

      expect(getMetadataUpdatedEvent(events, 1).eventName).toBe(
        CourseDomainEventName.METADATA_UPDATED,
      );

      expect(getSubmittedForReviewEvent(events, 2).eventName).toBe(
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
      );

      expect(getPublishedEvent(events, 3).eventName).toBe(
        CourseDomainEventName.PUBLISHED,
      );
    });

    it('drains unpublished and archived lifecycle events in order', () => {
      const course = createPublishedCourse();

      course.unpublish();
      course.archive();

      const events = course.pullDomainEvents();

      expect(events).toHaveLength(6);

      expect(getCreatedEvent(events, 0).eventName).toBe(
        CourseDomainEventName.CREATED,
      );

      expect(getMetadataUpdatedEvent(events, 1).eventName).toBe(
        CourseDomainEventName.METADATA_UPDATED,
      );

      expect(getSubmittedForReviewEvent(events, 2).eventName).toBe(
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
      );

      expect(getPublishedEvent(events, 3).eventName).toBe(
        CourseDomainEventName.PUBLISHED,
      );

      expect(getUnpublishedEvent(events, 4).eventName).toBe(
        CourseDomainEventName.UNPUBLISHED,
      );

      expect(getArchivedEvent(events, 5).eventName).toBe(
        CourseDomainEventName.ARCHIVED,
      );
    });

    it('preserves the original event IDs during draining', () => {
      const course = createCourseWithMetadataEvent();

      const beforePull = course.getDomainEvents();
      const createdEventId = getCreatedEvent(beforePull, 0).eventId;
      const metadataEventId = getMetadataUpdatedEvent(
        beforePull,
        1,
      ).eventId;

      const drainedEvents = course.pullDomainEvents();

      expect(getCreatedEvent(drainedEvents, 0).eventId).toBe(
        createdEventId,
      );
      expect(getMetadataUpdatedEvent(drainedEvents, 1).eventId).toBe(
        metadataEventId,
      );
    });

    it('preserves event timestamps during draining', () => {
      const course = createCourseWithMetadataEvent();

      const beforePull = course.getDomainEvents();

      const createdOccurredAt = getCreatedEvent(
        beforePull,
        0,
      ).occurredAt.getTime();

      const metadataOccurredAt = getMetadataUpdatedEvent(
        beforePull,
        1,
      ).occurredAt.getTime();

      const drainedEvents = course.pullDomainEvents();

      expect(
        getCreatedEvent(drainedEvents, 0).occurredAt.getTime(),
      ).toBe(createdOccurredAt);

      expect(
        getMetadataUpdatedEvent(drainedEvents, 1).occurredAt.getTime(),
      ).toBe(metadataOccurredAt);
    });
  });

  describe('post-drain event collection', () => {
    it('captures new events after a completed drain', () => {
      const course = createCourse();

      const firstPull = course.pullDomainEvents();

      expect(firstPull).toHaveLength(1);
      expect(course.getDomainEvents()).toHaveLength(0);

      course.updateMetadata({
        title: 'Post Drain Course',
      });

      const secondPull = course.pullDomainEvents();

      expect(secondPull).toHaveLength(1);
      expect(
        getMetadataUpdatedEvent(secondPull, 0).eventName,
      ).toBe(CourseDomainEventName.METADATA_UPDATED);
    });

    it('does not re-emit previously drained events', () => {
      const course = createCourse();

      const firstPull = course.pullDomainEvents();
      const firstEventId = getCreatedEvent(firstPull, 0).eventId;

      course.updateMetadata({
        title: 'Post Drain Course',
      });

      const secondPull = course.pullDomainEvents();

      expect(secondPull).toHaveLength(1);
      expect(secondPull[0]?.eventId).not.toBe(firstEventId);
    });

    it('supports multiple independent drain cycles', () => {
      const course = createCourse();

      const firstPull = course.pullDomainEvents();

      expect(firstPull).toHaveLength(1);
      expect(getCreatedEvent(firstPull, 0).eventName).toBe(
        CourseDomainEventName.CREATED,
      );

      course.updateMetadata({
        title: 'Second Cycle Course',
      });

      const secondPull = course.pullDomainEvents();

      expect(secondPull).toHaveLength(1);
      expect(getMetadataUpdatedEvent(secondPull, 0).eventName).toBe(
        CourseDomainEventName.METADATA_UPDATED,
      );

      course.submitForReview();

      const thirdPull = course.pullDomainEvents();

      expect(thirdPull).toHaveLength(1);
      expect(
        getSubmittedForReviewEvent(thirdPull, 0).eventName,
      ).toBe(CourseDomainEventName.SUBMITTED_FOR_REVIEW);
    });

    it('does not combine events from separate drain cycles', () => {
      const course = createCourse();

      const firstPull = course.pullDomainEvents();

      expect(firstPull).toHaveLength(1);

      course.updateMetadata({
        title: 'Separate Cycle Course',
      });

      const secondPull = course.pullDomainEvents();

      expect(secondPull).toHaveLength(1);

      expect(getCreatedEvent(firstPull, 0).eventName).toBe(
        CourseDomainEventName.CREATED,
      );

      expect(getMetadataUpdatedEvent(secondPull, 0).eventName).toBe(
        CourseDomainEventName.METADATA_UPDATED,
      );
    });
  });

  describe('drained-event snapshot isolation', () => {
    it('returns a detached event collection', () => {
      const course = createCourseWithMetadataEvent();

      const drainedEvents = course.pullDomainEvents();

      expect(drainedEvents).not.toBe(course.getDomainEvents());
      expect(drainedEvents).toHaveLength(2);
      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('allows mutation of drained collection without affecting future events', () => {
      const course = createCourse();

      const drainedEvents = course.pullDomainEvents();

      Reflect.set(drainedEvents, 'length', 0);

      expect(drainedEvents).toHaveLength(0);
      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('allows mutation of drained event objects without affecting aggregate state', () => {
      const course = createCourse();

      const drainedEvents = course.pullDomainEvents();
      const drainedEvent = getCreatedEvent(drainedEvents, 0);

      Reflect.set(drainedEvent, 'aggregateId', 'tampered-aggregate');
      Reflect.set(drainedEvent, 'eventId', 'tampered-event-id');

      expect(course.id.value).toBe(course.toPrimitives().id.value);
      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('allows mutation of drained payloads without affecting aggregate state', () => {
      const course = createCourse();

      const drainedEvents = course.pullDomainEvents();
      const drainedEvent = getCreatedEvent(drainedEvents, 0);

      Reflect.set(drainedEvent.payload, 'title', 'Tampered Title');
      Reflect.set(
        drainedEvent.payload,
        'instructorId',
        'Tampered Instructor',
      );

      expect(course.title).toBe('Draining Test Course');
      expect(course.instructorId).toBe('instructor-draining-test');
      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('allows mutation of drained dates without affecting aggregate state', () => {
      const course = createCourse();

      const drainedEvents = course.pullDomainEvents();
      const drainedEvent = getCreatedEvent(drainedEvents, 0);

      drainedEvent.occurredAt.setTime(0);

      expect(drainedEvent.occurredAt.getTime()).toBe(0);
      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('does not allow a drained event mutation to affect newly generated events', () => {
      const course = createCourse();

      const drainedEvents = course.pullDomainEvents();
      const drainedEvent = getCreatedEvent(drainedEvents, 0);

      Reflect.set(drainedEvent.payload, 'title', 'Tampered Title');

      course.updateMetadata({
        title: 'New Valid Course Title',
      });

      const newEvents = course.getDomainEvents();

      expect(newEvents).toHaveLength(1);

      const metadataEvent = getMetadataUpdatedEvent(newEvents, 0);

      expect(metadataEvent.payload.title).toBe('New Valid Course Title');
      expect(metadataEvent.payload.title).not.toBe('Tampered Title');
    });
  });

  describe('drain state consistency', () => {
    it('does not alter aggregate identity when draining events', () => {
      const course = createCourse();

      const originalId = course.id.value;

      course.pullDomainEvents();

      expect(course.id.value).toBe(originalId);
    });

    it('does not alter aggregate metadata when draining events', () => {
      const course = createCourse();

      const originalTitle = course.title;
      const originalDescription = course.description;

      course.pullDomainEvents();

      expect(course.title).toBe(originalTitle);
      expect(course.description).toBe(originalDescription);
    });

    it('does not alter aggregate lifecycle state when draining events', () => {
      const course = createPublishedCourse();

      const originalStatus = course.status;

      course.pullDomainEvents();

      expect(course.status).toBe(originalStatus);
    });

    it('does not alter aggregate timestamps when draining events', () => {
      const course = createCourse();

      const originalCreatedAt = course.createdAt.getTime();
      const originalUpdatedAt = course.updatedAt.getTime();

      course.pullDomainEvents();

      expect(course.createdAt.getTime()).toBe(originalCreatedAt);
      expect(course.updatedAt.getTime()).toBe(originalUpdatedAt);
    });

    it('leaves the aggregate usable after draining its event history', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.updateMetadata({
        title: 'Aggregate Still Usable',
      });

      expect(course.title).toBe('Aggregate Still Usable');

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(getMetadataUpdatedEvent(events, 0).payload.title).toBe(
        'Aggregate Still Usable',
      );
    });
  });
});
