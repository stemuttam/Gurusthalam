import { describe, expect, it } from 'vitest';

import { Course } from './course.js';
import {
  CourseDomainEventName,
  type CourseCreatedEvent,
  type CourseDomainEvent,
  type CourseMetadataUpdatedEvent,
} from '../events/course.events.js';
import { CourseLevel } from '../enums/course-level.js';
import { CourseType } from '../enums/course-type.js';
import { CourseVisibility } from '../enums/course-visibility.js';

function createCourse(): Course {
  return Course.create({
    title: 'Isolation Test Course',
    description: 'Original course description',
    level: CourseLevel.BEGINNER,
    type: CourseType.SELF_PACED,
    visibility: CourseVisibility.PRIVATE,
    instructorId: 'instructor-isolation-test',
  });
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

  expect(event.eventName).toBe(CourseDomainEventName.CREATED);

  return event as CourseCreatedEvent;
}

function getMetadataUpdatedEvent(
  events: readonly CourseDomainEvent[],
  index = 1,
): CourseMetadataUpdatedEvent {
  const event = getEventAt(events, index);

  expect(event.eventName).toBe(CourseDomainEventName.METADATA_UPDATED);

  return event as CourseMetadataUpdatedEvent;
}

function createCourseWithMetadataEvent(): Course {
  const course = createCourse();

  course.updateMetadata({
    title: 'Updated Isolation Course',
    description: 'Updated course description',
    visibility: CourseVisibility.PUBLIC,
  });

  return course;
}

describe('Course domain-event isolation and immutability', () => {
  describe('returned collection isolation', () => {
    it('returns a distinct event collection on every read', () => {
      const course = createCourse();

      const firstRead = course.getDomainEvents();
      const secondRead = course.getDomainEvents();

      expect(firstRead).not.toBe(secondRead);
      expect(firstRead).toEqual(secondRead);
    });

    it('prevents collection replacement from changing aggregate events', () => {
      const course = createCourse();

      const events = course.getDomainEvents();

      Reflect.set(events, 0, undefined);

      const reread = course.getDomainEvents();

      expect(reread).toHaveLength(1);
      expect(getEventAt(reread, 0).eventName).toBe(
        CourseDomainEventName.CREATED,
      );
    });

    it('prevents collection deletion from changing aggregate events', () => {
      const course = createCourse();

      const events = course.getDomainEvents();

      Reflect.deleteProperty(events, 0);

      const reread = course.getDomainEvents();

      expect(reread).toHaveLength(1);
      expect(getEventAt(reread, 0).eventName).toBe(
        CourseDomainEventName.CREATED,
      );
    });

    it('prevents collection length mutation from changing aggregate events', () => {
      const course = createCourse();

      const events = course.getDomainEvents();

      Reflect.set(events, 'length', 0);

      const reread = course.getDomainEvents();

      expect(reread).toHaveLength(1);
      expect(getEventAt(reread, 0).eventName).toBe(
        CourseDomainEventName.CREATED,
      );
    });
  });

  describe('event-object isolation', () => {
    it('returns distinct event objects on every read', () => {
      const course = createCourse();

      const firstEvent = getEventAt(course.getDomainEvents(), 0);
      const secondEvent = getEventAt(course.getDomainEvents(), 0);

      expect(firstEvent).not.toBe(secondEvent);
      expect(firstEvent).toEqual(secondEvent);
    });

    it('prevents eventId mutation from leaking into the aggregate', () => {
      const course = createCourse();

      const events = course.getDomainEvents();
      const event = getCreatedEvent(events);
      const originalEventId = event.eventId;

      Reflect.set(event, 'eventId', 'tampered-event-id');

      const rereadEvent = getCreatedEvent(course.getDomainEvents());

      expect(rereadEvent.eventId).toBe(originalEventId);
      expect(rereadEvent.eventId).not.toBe('tampered-event-id');
    });

    it('prevents eventName mutation from leaking into the aggregate', () => {
      const course = createCourse();

      const events = course.getDomainEvents();
      const event = getCreatedEvent(events);
      const originalEventName = event.eventName;

      Reflect.set(event, 'eventName', 'tampered.event');

      const rereadEvent = getCreatedEvent(course.getDomainEvents());

      expect(rereadEvent.eventName).toBe(originalEventName);
      expect(rereadEvent.eventName).toBe(CourseDomainEventName.CREATED);
    });

    it('prevents eventVersion mutation from leaking into the aggregate', () => {
      const course = createCourse();

      const events = course.getDomainEvents();
      const event = getCreatedEvent(events);
      const originalVersion = event.eventVersion;

      Reflect.set(event, 'eventVersion', 999);

      const rereadEvent = getCreatedEvent(course.getDomainEvents());

      expect(rereadEvent.eventVersion).toBe(originalVersion);
      expect(rereadEvent.eventVersion).toBe(1);
    });

    it('prevents aggregateId mutation from leaking into the aggregate', () => {
      const course = createCourse();

      const events = course.getDomainEvents();
      const event = getCreatedEvent(events);
      const originalAggregateId = event.aggregateId;

      Reflect.set(event, 'aggregateId', 'tampered-aggregate');

      const rereadEvent = getCreatedEvent(course.getDomainEvents());

      expect(rereadEvent.aggregateId).toBe(originalAggregateId);
      expect(rereadEvent.aggregateId).toBe(course.id.value);
    });

    it('prevents occurredAt mutation from leaking into the aggregate', () => {
      const course = createCourse();

      const events = course.getDomainEvents();
      const event = getCreatedEvent(events);
      const originalOccurredAt = event.occurredAt.getTime();

      event.occurredAt.setTime(0);

      const rereadEvent = getCreatedEvent(course.getDomainEvents());

      expect(rereadEvent.occurredAt.getTime()).toBe(originalOccurredAt);
      expect(rereadEvent.occurredAt.getTime()).not.toBe(0);
    });
  });

  describe('payload isolation', () => {
    it('returns distinct payload objects on every read', () => {
      const course = createCourse();

      const firstEvent = getCreatedEvent(course.getDomainEvents());
      const secondEvent = getCreatedEvent(course.getDomainEvents());

      expect(firstEvent.payload).not.toBe(secondEvent.payload);
      expect(firstEvent.payload).toEqual(secondEvent.payload);
    });

    it('prevents payload title mutation from leaking into the aggregate', () => {
      const course = createCourse();

      const events = course.getDomainEvents();
      const event = getCreatedEvent(events);

      Reflect.set(event.payload, 'title', 'Tampered Title');

      const rereadEvent = getCreatedEvent(course.getDomainEvents());

      expect(rereadEvent.payload.title).toBe('Isolation Test Course');
      expect(rereadEvent.payload.title).not.toBe('Tampered Title');
    });

    it('prevents payload description mutation from leaking into the aggregate', () => {
      const course = createCourse();

      const events = course.getDomainEvents();
      const event = getCreatedEvent(events);

      Reflect.set(event.payload, 'description', 'Tampered Description');

      const rereadEvent = getCreatedEvent(course.getDomainEvents());

      expect(rereadEvent.payload.description).toBe(
        'Original course description',
      );
      expect(rereadEvent.payload.description).not.toBe(
        'Tampered Description',
      );
    });

    it('prevents payload courseId mutation from leaking into the aggregate', () => {
      const course = createCourse();

      const events = course.getDomainEvents();
      const event = getCreatedEvent(events);

      Reflect.set(event.payload, 'courseId', 'tampered-course-id');

      const rereadEvent = getCreatedEvent(course.getDomainEvents());

      expect(rereadEvent.payload.courseId).toBe(course.id.value);
      expect(rereadEvent.payload.courseId).not.toBe('tampered-course-id');
    });

    it('prevents payload instructorId mutation from leaking into the aggregate', () => {
      const course = createCourse();

      const events = course.getDomainEvents();
      const event = getCreatedEvent(events);

      Reflect.set(event.payload, 'instructorId', 'tampered-instructor');

      const rereadEvent = getCreatedEvent(course.getDomainEvents());

      expect(rereadEvent.payload.instructorId).toBe(
        'instructor-isolation-test',
      );
      expect(rereadEvent.payload.instructorId).not.toBe(
        'tampered-instructor',
      );
    });

    it('isolates metadata payloads from subsequent reads', () => {
      const course = createCourseWithMetadataEvent();

      const events = course.getDomainEvents();
      const metadataEvent = getMetadataUpdatedEvent(events);

      Reflect.set(metadataEvent.payload, 'title', 'Tampered Metadata Title');

      const rereadEvents = course.getDomainEvents();
      const rereadMetadataEvent = getMetadataUpdatedEvent(rereadEvents);

      expect(rereadMetadataEvent.payload.title).toBe(
        'Updated Isolation Course',
      );
      expect(rereadMetadataEvent.payload.title).not.toBe(
        'Tampered Metadata Title',
      );
    });
  });

  describe('cross-event isolation', () => {
    it('mutating one event does not mutate another event', () => {
      const course = createCourseWithMetadataEvent();

      const events = course.getDomainEvents();
      const createdEvent = getCreatedEvent(events);
      const metadataEvent = getMetadataUpdatedEvent(events);

      Reflect.set(createdEvent, 'eventName', 'tampered.created');
      Reflect.set(createdEvent.payload, 'title', 'Tampered Created Title');

      expect(metadataEvent.eventName).toBe(
        CourseDomainEventName.METADATA_UPDATED,
      );
      expect(metadataEvent.payload.title).toBe('Updated Isolation Course');
    });

    it('mutating one payload does not mutate another payload', () => {
      const course = createCourseWithMetadataEvent();

      const events = course.getDomainEvents();
      const createdEvent = getCreatedEvent(events);
      const metadataEvent = getMetadataUpdatedEvent(events);

      Reflect.set(createdEvent.payload, 'title', 'Tampered Created Title');

      expect(metadataEvent.payload.title).toBe('Updated Isolation Course');
      expect(createdEvent.payload.title).toBe('Tampered Created Title');
    });

    it('mutating one event Date does not mutate another event Date', () => {
      const course = createCourseWithMetadataEvent();

      const events = course.getDomainEvents();
      const createdEvent = getCreatedEvent(events);
      const metadataEvent = getMetadataUpdatedEvent(events);

      const metadataOccurredAt = metadataEvent.occurredAt.getTime();

      createdEvent.occurredAt.setTime(0);

      expect(metadataEvent.occurredAt.getTime()).toBe(metadataOccurredAt);
      expect(metadataEvent.occurredAt.getTime()).not.toBe(0);
    });

    it('does not expose shared event references across repeated reads', () => {
      const course = createCourseWithMetadataEvent();

      const firstRead = course.getDomainEvents();
      const secondRead = course.getDomainEvents();

      const firstCreated = getCreatedEvent(firstRead);
      const secondCreated = getCreatedEvent(secondRead);
      const firstMetadata = getMetadataUpdatedEvent(firstRead);
      const secondMetadata = getMetadataUpdatedEvent(secondRead);

      expect(firstCreated).not.toBe(secondCreated);
      expect(firstCreated.payload).not.toBe(secondCreated.payload);
      expect(firstCreated.occurredAt).not.toBe(secondCreated.occurredAt);

      expect(firstMetadata).not.toBe(secondMetadata);
      expect(firstMetadata.payload).not.toBe(secondMetadata.payload);
      expect(firstMetadata.occurredAt).not.toBe(secondMetadata.occurredAt);
    });
  });

  describe('aggregate-state preservation', () => {
    it('preserves aggregate identity after external event mutation', () => {
      const course = createCourse();

      const events = course.getDomainEvents();
      const event = getCreatedEvent(events);

      Reflect.set(event, 'aggregateId', 'tampered-aggregate');
      Reflect.set(event.payload, 'courseId', 'tampered-course');

      expect(course.id.value).toBe(course.toPrimitives().id.value);

      const rereadEvent = getCreatedEvent(course.getDomainEvents());

      expect(rereadEvent.aggregateId).toBe(course.id.value);
      expect(rereadEvent.payload.courseId).toBe(course.id.value);
    });

    it('preserves aggregate metadata after external event mutation', () => {
      const course = createCourse();

      const events = course.getDomainEvents();
      const event = getCreatedEvent(events);

      Reflect.set(event.payload, 'title', 'Tampered Title');
      Reflect.set(event.payload, 'description', 'Tampered Description');

      expect(course.title).toBe('Isolation Test Course');
      expect(course.description).toBe('Original course description');
    });

    it('preserves event history after multiple external mutations', () => {
      const course = createCourseWithMetadataEvent();

      const events = course.getDomainEvents();

      const createdEvent = getCreatedEvent(events);
      const metadataEvent = getMetadataUpdatedEvent(events);

      Reflect.set(createdEvent, 'eventId', 'tampered-id');
      Reflect.set(createdEvent, 'aggregateId', 'tampered-aggregate');
      Reflect.set(createdEvent.payload, 'title', 'tampered-created-title');
      createdEvent.occurredAt.setTime(0);

      Reflect.set(metadataEvent, 'eventVersion', 999);
      Reflect.set(metadataEvent.payload, 'title', 'tampered-metadata-title');
      metadataEvent.occurredAt.setTime(0);

      const rereadEvents = course.getDomainEvents();

      expect(rereadEvents).toHaveLength(2);

      const rereadCreatedEvent = getCreatedEvent(rereadEvents);
      const rereadMetadataEvent = getMetadataUpdatedEvent(rereadEvents);

      expect(rereadCreatedEvent.eventName).toBe(
        CourseDomainEventName.CREATED,
      );
      expect(rereadCreatedEvent.aggregateId).toBe(course.id.value);
      expect(rereadCreatedEvent.payload.title).toBe(
        'Isolation Test Course',
      );
      expect(rereadCreatedEvent.occurredAt.getTime()).not.toBe(0);

      expect(rereadMetadataEvent.eventName).toBe(
        CourseDomainEventName.METADATA_UPDATED,
      );
      expect(rereadMetadataEvent.eventVersion).toBe(1);
      expect(rereadMetadataEvent.payload.title).toBe(
        'Updated Isolation Course',
      );
      expect(rereadMetadataEvent.occurredAt.getTime()).not.toBe(0);
    });

    it('preserves event history after mutating a previously returned snapshot', () => {
      const course = createCourseWithMetadataEvent();

      const snapshot = course.getDomainEvents();
      const firstEvent = getCreatedEvent(snapshot);

      Reflect.set(firstEvent.payload, 'title', 'Tampered Title');
      Reflect.set(snapshot, 'length', 0);

      const freshSnapshot = course.getDomainEvents();

      expect(freshSnapshot).toHaveLength(2);
      expect(getCreatedEvent(freshSnapshot).payload.title).toBe(
        'Isolation Test Course',
      );
      expect(getMetadataUpdatedEvent(freshSnapshot).payload.title).toBe(
        'Updated Isolation Course',
      );
    });
  });
});