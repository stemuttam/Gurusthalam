import { describe, expect, it } from 'vitest';

import { Course } from './course.js';

import {
  CourseDomainEventName,
  type CourseCreatedEvent,
  type CourseDomainEvent,
  type CourseMetadataUpdatedEvent,
  type CourseStatusChangedPayload,
} from '../events/course.events.js';

import { CourseLevel } from '../enums/course-level.js';
import { CourseStatus } from '../enums/course-status.js';
import { CourseType } from '../enums/course-type.js';
import { CourseVisibility } from '../enums/course-visibility.js';

function createCourse(): Course {
  return Course.create({
    title: 'Final Regression Course',
    description: 'Final domain-event regression description',
    level: CourseLevel.BEGINNER,
    type: CourseType.SELF_PACED,
    visibility: CourseVisibility.PRIVATE,
    instructorId: 'instructor-final-regression',
  });
}

function createCourseWithMetadataUpdate(): Course {
  const course = createCourse();

  course.updateMetadata({
    title: 'Final Regression Updated Course',
    description: 'Final domain-event regression updated description',
    visibility: CourseVisibility.PUBLIC,
  });

  return course;
}

function createPublishedCourse(): Course {
  const course = createCourseWithMetadataUpdate();

  course.submitForReview();
  course.publish();

  return course;
}

function createArchivedCourse(): Course {
  const course = createPublishedCourse();

  course.archive();

  return course;
}

function createUnpublishedThenArchivedCourse(): Course {
  const course = createPublishedCourse();

  course.unpublish();
  course.archive();

  return course;
}

function createCompleteLifecycleCourse(): Course {
  const course = createCourse();

  course.updateMetadata({
    title: 'Complete Lifecycle Course',
  });

  course.submitForReview();
  course.publish();
  course.unpublish();
  course.archive();

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

  expect(event.eventName).toBe(CourseDomainEventName.CREATED);

  if (event.eventName !== CourseDomainEventName.CREATED) {
    throw new Error(
      `Expected a created event but received ${event.eventName}`,
    );
  }

  return event;
}

function getMetadataUpdatedEvent(
  events: readonly CourseDomainEvent[],
  index: number,
): CourseMetadataUpdatedEvent {
  const event = getEventAt(events, index);

  expect(event.eventName).toBe(CourseDomainEventName.METADATA_UPDATED);

  if (event.eventName !== CourseDomainEventName.METADATA_UPDATED) {
    throw new Error(
      `Expected a metadata-updated event but received ${event.eventName}`,
    );
  }

  return event;
}

function getStatusChangedEvent(
  events: readonly CourseDomainEvent[],
  index: number,
): CourseDomainEvent {
  const event = getEventAt(events, index);

  switch (event.eventName) {
    case CourseDomainEventName.SUBMITTED_FOR_REVIEW:
    case CourseDomainEventName.PUBLISHED:
    case CourseDomainEventName.UNPUBLISHED:
    case CourseDomainEventName.ARCHIVED:
      return event;

    default:
      throw new Error(
        `Expected a status-change event but received ${event.eventName}`,
      );
  }
}

function getStatusChangedPayload(
  event: CourseDomainEvent,
): CourseStatusChangedPayload {
  switch (event.eventName) {
    case CourseDomainEventName.SUBMITTED_FOR_REVIEW:
    case CourseDomainEventName.PUBLISHED:
    case CourseDomainEventName.UNPUBLISHED:
    case CourseDomainEventName.ARCHIVED:
      return event.payload;

    default:
      throw new Error(
        `Expected a status-change event but received ${event.eventName}`,
      );
  }
}

function expectCommonEventContract(
  event: CourseDomainEvent,
  course: Course,
): void {
  expect(event.eventId).toEqual(expect.any(String));
  expect(event.eventId.length).toBeGreaterThan(0);
  expect(event.eventVersion).toBe(1);
  expect(event.aggregateId).toBe(course.id.value);
  expect(event.occurredAt).toBeInstanceOf(Date);
  expect(Number.isNaN(event.occurredAt.getTime())).toBe(false);
}

function expectCreatedPayload(
  event: CourseCreatedEvent,
  course: Course,
): void {
  expect(event.payload.courseId).toBe(course.id.value);
  expect(event.payload.title).toBe(course.title);
  expect(event.payload.description).toBe(course.description);
  expect(event.payload.level).toBe(course.level);
  expect(event.payload.type).toBe(course.type);
  expect(event.payload.visibility).toBe(course.visibility);
  expect(event.payload.status).toBe(CourseStatus.DRAFT);
  expect(event.payload.instructorId).toBe(course.instructorId);
}

function expectMetadataPayload(
  event: CourseMetadataUpdatedEvent,
  course: Course,
): void {
  expect(event.payload.courseId).toBe(course.id.value);
  expect(event.payload.title).toBe(course.title);
  expect(event.payload.description).toBe(course.description);
  expect(event.payload.level).toBe(course.level);
  expect(event.payload.type).toBe(course.type);
  expect(event.payload.visibility).toBe(course.visibility);
}

function expectStatusPayload(
  event: CourseDomainEvent,
  course: Course,
  expectedPreviousStatus: CourseStatus,
  expectedCurrentStatus: CourseStatus,
): void {
  const payload = getStatusChangedPayload(event);

  expect(payload.courseId).toBe(course.id.value);
  expect(payload.previousStatus).toBe(expectedPreviousStatus);
  expect(payload.currentStatus).toBe(expectedCurrentStatus);
}

describe('Course domain-event final regression', () => {
  describe('aggregate-wide event contract', () => {
    it('records exactly one creation event for a new Course', () => {
      const course = createCourse();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe(CourseDomainEventName.CREATED);

      for (const event of events) {
        expectCommonEventContract(event, course);
      }
    });

    it('keeps every event associated with the same aggregate', () => {
      const course = createCompleteLifecycleCourse();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(6);

      for (const event of events) {
        expectCommonEventContract(event, course);
        expect(event.aggregateId).toBe(course.id.value);
        expect(event.payload.courseId).toBe(course.id.value);
      }
    });

    it('assigns version 1 to every Course domain event', () => {
      const course = createCompleteLifecycleCourse();

      const events = course.getDomainEvents();

      for (const event of events) {
        expect(event.eventVersion).toBe(1);
      }
    });

    it('assigns a unique event identifier to every event', () => {
      const course = createCompleteLifecycleCourse();

      const events = course.getDomainEvents();
      const eventIds = events.map((event) => event.eventId);

      expect(new Set(eventIds).size).toBe(eventIds.length);
    });

    it('creates valid occurrence timestamps for every event', () => {
      const course = createCompleteLifecycleCourse();

      const events = course.getDomainEvents();

      for (const event of events) {
        expect(event.occurredAt).toBeInstanceOf(Date);
        expect(Number.isNaN(event.occurredAt.getTime())).toBe(false);
      }
    });
  });

  describe('creation event regression', () => {
    it('preserves the creation event payload as the initial Course snapshot', () => {
      const course = createCourse();

      const events = course.getDomainEvents();
      const createdEvent = getCreatedEvent(events);

      expectCreatedPayload(createdEvent, course);
    });

    it('records the creation event before later lifecycle events', () => {
      const course = createPublishedCourse();

      const events = course.getDomainEvents();

      expect(events[0]?.eventName).toBe(CourseDomainEventName.CREATED);
      expect(events[1]?.eventName).toBe(
        CourseDomainEventName.METADATA_UPDATED,
      );
      expect(events[2]?.eventName).toBe(
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
      );
      expect(events[3]?.eventName).toBe(CourseDomainEventName.PUBLISHED);
    });

    it('keeps the creation payload stable after aggregate mutation', () => {
      const course = createCourse();

      const createdEvent = getCreatedEvent(course.getDomainEvents());

      course.updateMetadata({
        title: 'Later Title',
        description: 'Later Description',
        visibility: CourseVisibility.PUBLIC,
      });

      expect(createdEvent.payload.title).toBe('Final Regression Course');
      expect(createdEvent.payload.description).toBe(
        'Final domain-event regression description',
      );
      expect(createdEvent.payload.visibility).toBe(
        CourseVisibility.PRIVATE,
      );
    });
  });

  describe('metadata event regression', () => {
    it('records exactly one metadata event for one successful metadata mutation', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Updated Title',
      });

      const events = course.getDomainEvents();

      expect(events).toHaveLength(2);
      expect(events[1]?.eventName).toBe(
        CourseDomainEventName.METADATA_UPDATED,
      );
    });

    it('records the complete updated metadata snapshot', () => {
      const course = createCourseWithMetadataUpdate();

      const events = course.getDomainEvents();
      const metadataEvent = getMetadataUpdatedEvent(events, 1);

      expectMetadataPayload(metadataEvent, course);
    });

    it('keeps metadata events ordered after creation', () => {
      const course = createCourseWithMetadataUpdate();

      const events = course.getDomainEvents();

      expect(events[0]?.eventName).toBe(CourseDomainEventName.CREATED);
      expect(events[1]?.eventName).toBe(
        CourseDomainEventName.METADATA_UPDATED,
      );
    });

    it('records multiple successful metadata changes independently', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'First Update',
      });

      course.updateMetadata({
        title: 'Second Update',
      });

      const events = course.getDomainEvents();

      expect(events).toHaveLength(3);
      expect(events[0]?.eventName).toBe(CourseDomainEventName.CREATED);
      expect(events[1]?.eventName).toBe(
        CourseDomainEventName.METADATA_UPDATED,
      );
      expect(events[2]?.eventName).toBe(
        CourseDomainEventName.METADATA_UPDATED,
      );
    });

    it('preserves each metadata event snapshot independently', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'First Update',
      });

      const firstEvents = course.getDomainEvents();
      const firstMetadataEvent = getMetadataUpdatedEvent(firstEvents, 1);

      course.updateMetadata({
        title: 'Second Update',
      });

      expect(firstMetadataEvent.payload.title).toBe('First Update');

      const finalEvents = course.getDomainEvents();
      const secondMetadataEvent = getMetadataUpdatedEvent(finalEvents, 2);

      expect(secondMetadataEvent.payload.title).toBe('Second Update');
    });
  });

  describe('full lifecycle event regression', () => {
    it('records the complete expected event sequence through ARCHIVED', () => {
      const course = createCompleteLifecycleCourse();

      const events = course.getDomainEvents();

      expect(events.map((event) => event.eventName)).toEqual([
        CourseDomainEventName.CREATED,
        CourseDomainEventName.METADATA_UPDATED,
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
        CourseDomainEventName.PUBLISHED,
        CourseDomainEventName.UNPUBLISHED,
        CourseDomainEventName.ARCHIVED,
      ]);
    });

    it('records the correct submitted-for-review transition', () => {
      const course = createCourseWithMetadataUpdate();

      course.submitForReview();

      const events = course.getDomainEvents();
      const event = getStatusChangedEvent(events, 2);

      expect(event.eventName).toBe(
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
      );

      expectStatusPayload(
        event,
        course,
        CourseStatus.DRAFT,
        CourseStatus.IN_REVIEW,
      );
    });

    it('records the correct published transition', () => {
      const course = createCourseWithMetadataUpdate();

      course.submitForReview();
      course.publish();

      const events = course.getDomainEvents();
      const event = getStatusChangedEvent(events, 3);

      expect(event.eventName).toBe(CourseDomainEventName.PUBLISHED);

      expectStatusPayload(
        event,
        course,
        CourseStatus.IN_REVIEW,
        CourseStatus.PUBLISHED,
      );
    });

    it('records the correct unpublished transition', () => {
      const course = createPublishedCourse();

      course.unpublish();

      const events = course.getDomainEvents();
      const event = getStatusChangedEvent(events, 4);

      expect(event.eventName).toBe(CourseDomainEventName.UNPUBLISHED);

      expectStatusPayload(
        event,
        course,
        CourseStatus.PUBLISHED,
        CourseStatus.UNPUBLISHED,
      );
    });

    it('records the correct archived transition from PUBLISHED', () => {
      const course = createPublishedCourse();

      course.archive();

      const events = course.getDomainEvents();
      const event = getStatusChangedEvent(events, 4);

      expect(event.eventName).toBe(CourseDomainEventName.ARCHIVED);

      expectStatusPayload(
        event,
        course,
        CourseStatus.PUBLISHED,
        CourseStatus.ARCHIVED,
      );
    });

    it('records the correct archived transition from UNPUBLISHED', () => {
      const course = createUnpublishedThenArchivedCourse();

      const events = course.getDomainEvents();
      const event = getStatusChangedEvent(events, 5);

      expect(event.eventName).toBe(CourseDomainEventName.ARCHIVED);

      expectStatusPayload(
        event,
        course,
        CourseStatus.UNPUBLISHED,
        CourseStatus.ARCHIVED,
      );
    });
  });

  describe('rejected lifecycle action regression', () => {
    it('does not create an event when publishing directly from DRAFT', () => {
      const course = createCourse();

      expect(() => course.publish()).toThrow();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe(CourseDomainEventName.CREATED);
    });

    it('does not create an event when unpublishing from DRAFT', () => {
      const course = createCourse();

      expect(() => course.unpublish()).toThrow();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);
    });

    it('does not create an event when archiving from DRAFT', () => {
      const course = createCourse();

      expect(() => course.archive()).toThrow();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);
    });

    it('does not create an event when publishing an already published Course', () => {
      const course = createPublishedCourse();
      const eventCount = course.getDomainEvents().length;

      expect(() => course.publish()).toThrow();

      expect(course.getDomainEvents()).toHaveLength(eventCount);
    });

    it('does not create an event when re-archiving an archived Course', () => {
      const course = createArchivedCourse();
      const eventCount = course.getDomainEvents().length;

      expect(() => course.archive()).toThrow();

      expect(course.getDomainEvents()).toHaveLength(eventCount);
    });

    it('does not create an event when submitting an archived Course for review', () => {
      const course = createArchivedCourse();
      const eventCount = course.getDomainEvents().length;

      expect(() => course.submitForReview()).toThrow();

      expect(course.getDomainEvents()).toHaveLength(eventCount);
    });
  });

  describe('read isolation regression', () => {
    it('does not clear events when getDomainEvents is called', () => {
      const course = createArchivedCourse();

      const firstRead = course.getDomainEvents();
      const secondRead = course.getDomainEvents();

      expect(firstRead).toHaveLength(5);
      expect(secondRead).toHaveLength(5);
    });

    it('returns independent event collections on repeated reads', () => {
      const course = createArchivedCourse();

      const firstRead = course.getDomainEvents();
      const secondRead = course.getDomainEvents();

      expect(firstRead).not.toBe(secondRead);
      expect(firstRead).toEqual(secondRead);
    });

    it('does not expose the internal event array through mutation of a returned array', () => {
      const course = createArchivedCourse();

      const events = [...course.getDomainEvents()];

      events.splice(0, events.length);

      expect(course.getDomainEvents()).toHaveLength(5);
    });

    it('returns detached event payload objects from getDomainEvents', () => {
      const course = createCourse();

      const events = course.getDomainEvents();
      const createdEvent = getCreatedEvent(events);

      const originalTitle = createdEvent.payload.title;

      Reflect.set(
        createdEvent.payload,
        'title',
        'Mutated External Title',
      );

      expect(createdEvent.payload.title).toBe('Mutated External Title');
      expect(originalTitle).toBe('Final Regression Course');

      const freshEvents = course.getDomainEvents();
      const freshCreatedEvent = getCreatedEvent(freshEvents);

      expect(freshCreatedEvent.payload.title).toBe(
        'Final Regression Course',
      );
    });

    it('does not allow occurredAt mutation to affect stored event state', () => {
      const course = createCourse();

      const events = course.getDomainEvents();
      const createdEvent = getCreatedEvent(events);
      const originalTimestamp = createdEvent.occurredAt.getTime();

      createdEvent.occurredAt.setTime(0);

      const freshEvents = course.getDomainEvents();
      const freshCreatedEvent = getCreatedEvent(freshEvents);

      expect(freshCreatedEvent.occurredAt.getTime()).toBe(
        originalTimestamp,
      );
    });
  });

  describe('draining regression', () => {
    it('pulls all pending events in their original order', () => {
      const course = createArchivedCourse();

      const events = course.pullDomainEvents();

      expect(events.map((event) => event.eventName)).toEqual([
        CourseDomainEventName.CREATED,
        CourseDomainEventName.METADATA_UPDATED,
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
        CourseDomainEventName.PUBLISHED,
        CourseDomainEventName.ARCHIVED,
      ]);
    });

    it('clears the pending event queue after pulling', () => {
      const course = createArchivedCourse();

      expect(course.pullDomainEvents()).toHaveLength(5);
      expect(course.pullDomainEvents()).toHaveLength(0);
      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('allows new events to be collected after a drain', () => {
      const course = createCourse();

      const firstBatch = course.pullDomainEvents();

      expect(firstBatch).toHaveLength(1);

      course.updateMetadata({
        title: 'After Drain',
      });

      const secondBatch = course.pullDomainEvents();

      expect(secondBatch).toHaveLength(1);
      expect(secondBatch[0]?.eventName).toBe(
        CourseDomainEventName.METADATA_UPDATED,
      );
    });

    it('keeps drained batches independent from later batches', () => {
      const course = createCourse();

      const firstBatch = course.pullDomainEvents();

      course.updateMetadata({
        title: 'Second Batch',
      });

      const secondBatch = course.pullDomainEvents();

      expect(firstBatch).toHaveLength(1);
      expect(secondBatch).toHaveLength(1);

      expect(firstBatch[0]?.eventName).toBe(
        CourseDomainEventName.CREATED,
      );
      expect(secondBatch[0]?.eventName).toBe(
        CourseDomainEventName.METADATA_UPDATED,
      );
    });

    it('returns an empty collection when no events remain pending', () => {
      const course = createCourse();

      course.pullDomainEvents();

      const events = course.pullDomainEvents();

      expect(events).toEqual([]);
    });
  });

  describe('rehydration regression', () => {
    it('does not generate domain events during rehydration', () => {
      const original = createPublishedCourse();

      const rehydrated = Course.rehydrate(original.toPrimitives());

      expect(rehydrated.getDomainEvents()).toEqual([]);
    });

    it('preserves the aggregate identity during rehydration', () => {
      const original = createPublishedCourse();

      const rehydrated = Course.rehydrate(original.toPrimitives());

      expect(rehydrated.id.value).toBe(original.id.value);
    });

    it('preserves the aggregate lifecycle state during rehydration', () => {
      const original = createPublishedCourse();

      const rehydrated = Course.rehydrate(original.toPrimitives());

      expect(rehydrated.status).toBe(CourseStatus.PUBLISHED);
    });

    it('allows legitimate events after rehydration', () => {
      const original = createPublishedCourse();

      const rehydrated = Course.rehydrate(original.toPrimitives());

      rehydrated.unpublish();

      const events = rehydrated.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe(
        CourseDomainEventName.UNPUBLISHED,
      );
    });

    it('associates post-rehydration events with the original aggregate', () => {
      const original = createPublishedCourse();

      const rehydrated = Course.rehydrate(original.toPrimitives());

      rehydrated.unpublish();

      const events = rehydrated.getDomainEvents();
      const event = getEventAt(events, 0);

      expect(event.aggregateId).toBe(original.id.value);
      expect(event.payload.courseId).toBe(original.id.value);
    });
  });

  describe('timestamp and chronology regression', () => {
    it('keeps event timestamps valid across the complete lifecycle', () => {
      const course = createCompleteLifecycleCourse();

      const events = course.getDomainEvents();

      for (const event of events) {
        expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(
          course.createdAt.getTime(),
        );
      }
    });

    it('keeps event timestamps non-decreasing in event order', () => {
      const course = createCompleteLifecycleCourse();

      const events = course.getDomainEvents();

      for (let index = 1; index < events.length; index += 1) {
        const previousEvent = events[index - 1];
        const currentEvent = events[index];

        expect.assert(previousEvent);
        expect.assert(currentEvent);

        expect(currentEvent.occurredAt.getTime()).toBeGreaterThanOrEqual(
          previousEvent.occurredAt.getTime(),
        );
      }
    });

    it('keeps metadata event timing aligned with aggregate mutation timing', () => {
      const course = createCourse();

      const previousUpdatedAt = course.updatedAt.getTime();

      course.updateMetadata({
        title: 'Timestamp Regression Update',
      });

      const events = course.getDomainEvents();
      const metadataEvent = getMetadataUpdatedEvent(events, 1);

      expect(metadataEvent.occurredAt.getTime()).toBeGreaterThanOrEqual(
        previousUpdatedAt,
      );

      expect(metadataEvent.occurredAt.getTime()).toBeLessThanOrEqual(
        course.updatedAt.getTime(),
      );
    });

    it('keeps creation event timing within the Course creation window', () => {
      const course = createCourse();

      const createdEvent = getCreatedEvent(course.getDomainEvents());

      expect(createdEvent.occurredAt.getTime()).toBeGreaterThanOrEqual(
        course.createdAt.getTime(),
      );

      expect(createdEvent.occurredAt.getTime()).toBeLessThanOrEqual(
        course.updatedAt.getTime(),
      );
    });
  });

  describe('final contract matrix', () => {
    it('maintains the expected lifecycle state after the complete event sequence', () => {
      const course = createCompleteLifecycleCourse();

      expect(course.status).toBe(CourseStatus.ARCHIVED);
    });

    it('keeps event count aligned with successful domain actions', () => {
      const course = createCourse();

      expect(course.getDomainEvents()).toHaveLength(1);

      course.updateMetadata({
        title: 'Action One',
      });

      expect(course.getDomainEvents()).toHaveLength(2);

      course.submitForReview();

      expect(course.getDomainEvents()).toHaveLength(3);

      course.publish();

      expect(course.getDomainEvents()).toHaveLength(4);

      course.unpublish();

      expect(course.getDomainEvents()).toHaveLength(5);

      course.archive();

      expect(course.getDomainEvents()).toHaveLength(6);
    });

    it('does not create duplicate events when state is only read', () => {
      const course = createPublishedCourse();

      const before = course.getDomainEvents();

      course.getDomainEvents();
      course.getDomainEvents();
      course.toPrimitives();

      const after = course.getDomainEvents();

      expect(after).toEqual(before);
      expect(after).toHaveLength(4);
    });

    it('preserves all six events through repeated non-destructive reads', () => {
      const course = createCompleteLifecycleCourse();

      const first = course.getDomainEvents();
      const second = course.getDomainEvents();
      const third = course.getDomainEvents();

      expect(first).toHaveLength(6);
      expect(second).toHaveLength(6);
      expect(third).toHaveLength(6);

      expect(first).toEqual(second);
      expect(second).toEqual(third);
    });

    it('keeps the final event as the ARCHIVED event after the full lifecycle', () => {
      const course = createCompleteLifecycleCourse();

      const events = course.getDomainEvents();
      const finalEvent = events.at(-1);

      expect(finalEvent?.eventName).toBe(
        CourseDomainEventName.ARCHIVED,
      );
    });

    it('keeps the final archived payload transition correct', () => {
      const course = createCompleteLifecycleCourse();

      const events = course.getDomainEvents();
      const finalEvent = getStatusChangedEvent(events, 5);

      expectStatusPayload(
        finalEvent,
        course,
        CourseStatus.UNPUBLISHED,
        CourseStatus.ARCHIVED,
      );
    });

    it('keeps every event payload tied to the same course identity', () => {
      const course = createCompleteLifecycleCourse();

      const events = course.getDomainEvents();

      for (const event of events) {
        expect(event.aggregateId).toBe(course.id.value);
        expect(event.payload.courseId).toBe(course.id.value);
      }
    });

    it('does not lose domain events when the aggregate is serialized', () => {
      const course = createPublishedCourse();

      const before = course.getDomainEvents();

      const primitives = course.toPrimitives();

      expect(primitives.id.value).toBe(course.id.value);
      expect(course.getDomainEvents()).toEqual(before);
    });

    it('supports a complete create-to-drain-to-rehydrate-to-mutate cycle', () => {
      const original = createCourse();

      original.updateMetadata({
        title: 'Cycle Course',
      });

      original.submitForReview();
      original.publish();

      const firstBatch = original.pullDomainEvents();

      expect(firstBatch).toHaveLength(4);

      const rehydrated = Course.rehydrate(original.toPrimitives());

      expect(rehydrated.getDomainEvents()).toEqual([]);

      rehydrated.unpublish();

      const secondBatch = rehydrated.pullDomainEvents();

      expect(secondBatch).toHaveLength(1);
      expect(secondBatch[0]?.eventName).toBe(
        CourseDomainEventName.UNPUBLISHED,
      );
      expect(secondBatch[0]?.aggregateId).toBe(original.id.value);
    });
  });
});