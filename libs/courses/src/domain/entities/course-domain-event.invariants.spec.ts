import { describe, expect, it } from 'vitest';

import { Course } from './course.js';

import { CourseLevel } from '../enums/course-level.js';
import { CourseType } from '../enums/course-type.js';
import { CourseVisibility } from '../enums/course-visibility.js';

import {
  CourseValidationError,
  InvalidCourseStateTransitionError,
} from '../errors/index.js';

const createCourse = () =>
  Course.create({
    title: 'TypeScript Fundamentals',
    description: 'Learn TypeScript from the ground up.',
    level: CourseLevel.BEGINNER,
    type: CourseType.SELF_PACED,
    visibility: CourseVisibility.PRIVATE,
    instructorId: 'instructor-123',
  });

const moveToPublished = (course: Course): void => {
  course.submitForReview();
  course.publish();
};

const getSingleEvent = (course: Course) => {
  const events = course.pullDomainEvents();

  expect(events).toHaveLength(1);

  const event = events[0];

  if (event === undefined) {
    throw new Error('Expected exactly one domain event.');
  }

  return event;
};

describe('Course domain-event invariants', () => {
  describe('event timestamp invariants', () => {
    it('creates a valid event timestamp when the Course is created', () => {
      const course = createCourse();
      const event = getSingleEvent(course);

      expect(event.occurredAt).toBeInstanceOf(Date);
      expect(event.occurredAt.getTime()).not.toBeNaN();
    });

    it('creates an event timestamp that is not earlier than Course createdAt', () => {
      const course = createCourse();
      const event = getSingleEvent(course);

      expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(
        course.createdAt.getTime(),
      );
    });

    it('creates an event timestamp that is not later than Course updatedAt', () => {
      const course = createCourse();
      const event = getSingleEvent(course);

      expect(event.occurredAt.getTime()).toBeLessThanOrEqual(
        course.updatedAt.getTime(),
      );
    });

    it('keeps event timestamps valid after a successful mutation', () => {
      const course = createCourse();

      course.pullDomainEvents();

      const previousUpdatedAt = course.updatedAt.getTime();

      course.updateMetadata({
        title: 'Updated Course',
      });

      const event = getSingleEvent(course);

      expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(
        previousUpdatedAt,
      );

      expect(event.occurredAt.getTime()).toBeLessThanOrEqual(
        course.updatedAt.getTime(),
      );
    });
  });

  describe('event identity invariants', () => {
    it('uses the Course identity as the event aggregateId', () => {
      const course = createCourse();
      const event = getSingleEvent(course);

      expect(event.aggregateId).toBe(course.id.toString());
    });

    it('uses the same aggregate identity for every successful event', () => {
      const course = createCourse();

      const createdEvent = getSingleEvent(course);

      course.updateMetadata({
        title: 'Updated Course',
      });

      const metadataEvent = getSingleEvent(course);

      course.submitForReview();

      const reviewEvent = getSingleEvent(course);

      course.publish();

      const publishedEvent = getSingleEvent(course);

      expect(createdEvent.aggregateId).toBe(course.id.toString());
      expect(metadataEvent.aggregateId).toBe(course.id.toString());
      expect(reviewEvent.aggregateId).toBe(course.id.toString());
      expect(publishedEvent.aggregateId).toBe(course.id.toString());
    });

    it('generates a unique eventId for each domain event', () => {
      const course = createCourse();

      const createdEvent = getSingleEvent(course);

      course.updateMetadata({
        title: 'Updated Course',
      });

      const metadataEvent = getSingleEvent(course);

      course.submitForReview();

      const reviewEvent = getSingleEvent(course);

      expect(createdEvent.eventId).not.toBe(metadataEvent.eventId);
      expect(createdEvent.eventId).not.toBe(reviewEvent.eventId);
      expect(metadataEvent.eventId).not.toBe(reviewEvent.eventId);
    });

    it('preserves event identity after Course rehydration', () => {
      const course = createCourse();

      const primitives = course.toPrimitives();
      const rehydrated = Course.rehydrate(primitives);

      expect(rehydrated.id.toString()).toBe(course.id.toString());
      expect(rehydrated.getDomainEvents()).toHaveLength(0);

      rehydrated.updateMetadata({
        title: 'Updated After Rehydration',
      });

      const event = getSingleEvent(rehydrated);

      expect(event.aggregateId).toBe(rehydrated.id.toString());
    });
  });

  describe('event cardinality invariants', () => {
    it('records exactly one event when a Course is created', () => {
      const course = createCourse();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe('courses.course.created');
    });

    it('records exactly one event for successful metadata mutation', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.updateMetadata({
        title: 'Updated Course',
      });

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe(
        'courses.course.metadata_updated',
      );
    });

    it('records exactly one event for successful submission', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe(
        'courses.course.submitted_for_review',
      );
    });

    it('records exactly one event for successful publication', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();
      course.pullDomainEvents();

      course.publish();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe('courses.course.published');
    });

    it('records exactly one event for successful unpublication', () => {
      const course = createCourse();

      moveToPublished(course);
      course.pullDomainEvents();

      course.unpublish();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe('courses.course.unpublished');
    });

    it('records exactly one event for successful archiving', () => {
      const course = createCourse();

      moveToPublished(course);
      course.pullDomainEvents();

      course.archive();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe('courses.course.archived');
    });
  });

  describe('failed-operation event invariants', () => {
    it('does not record an event when metadata validation fails', () => {
      const course = createCourse();

      course.pullDomainEvents();

      expect(() =>
        course.updateMetadata({
          title: '',
        }),
      ).toThrow(CourseValidationError);

      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('does not record an event when metadata mutation is blocked by lifecycle state', () => {
      const course = createCourse();

      course.pullDomainEvents();
      course.submitForReview();
      course.pullDomainEvents();

      expect(() =>
        course.updateMetadata({
          title: 'Illegal Update',
        }),
      ).toThrow(CourseValidationError);

      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('does not record an event when publication is rejected', () => {
      const course = createCourse();

      course.pullDomainEvents();

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('does not record an event when unpublication is rejected', () => {
      const course = createCourse();

      course.pullDomainEvents();

      expect(() => course.unpublish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('does not record an event when archiving is rejected', () => {
      const course = createCourse();

      course.pullDomainEvents();

      expect(() => course.archive()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('event ordering invariants', () => {
    it('records lifecycle events in domain order', () => {
      const course = createCourse();

      const createdEvent = getSingleEvent(course);

      course.updateMetadata({
        title: 'Updated Course',
      });

      const metadataEvent = getSingleEvent(course);

      course.submitForReview();

      const reviewEvent = getSingleEvent(course);

      course.publish();

      const publishedEvent = getSingleEvent(course);

      course.unpublish();

      const unpublishedEvent = getSingleEvent(course);

      course.archive();

      const archivedEvent = getSingleEvent(course);

      expect([
        createdEvent.eventName,
        metadataEvent.eventName,
        reviewEvent.eventName,
        publishedEvent.eventName,
        unpublishedEvent.eventName,
        archivedEvent.eventName,
      ]).toEqual([
        'courses.course.created',
        'courses.course.metadata_updated',
        'courses.course.submitted_for_review',
        'courses.course.published',
        'courses.course.unpublished',
        'courses.course.archived',
      ]);
    });

    it('keeps event timestamps non-decreasing across successful operations', () => {
      const course = createCourse();

      const createdEvent = getSingleEvent(course);

      course.updateMetadata({
        title: 'Updated Course',
      });

      const metadataEvent = getSingleEvent(course);

      course.submitForReview();

      const reviewEvent = getSingleEvent(course);

      course.publish();

      const publishedEvent = getSingleEvent(course);

      course.unpublish();

      const unpublishedEvent = getSingleEvent(course);

      course.archive();

      const archivedEvent = getSingleEvent(course);

      const timestamps = [
        createdEvent.occurredAt.getTime(),
        metadataEvent.occurredAt.getTime(),
        reviewEvent.occurredAt.getTime(),
        publishedEvent.occurredAt.getTime(),
        unpublishedEvent.occurredAt.getTime(),
        archivedEvent.occurredAt.getTime(),
      ];

      for (let index = 1; index < timestamps.length; index += 1) {
        const previousTimestamp = timestamps[index - 1];
        const currentTimestamp = timestamps[index];

        if (
          previousTimestamp === undefined ||
          currentTimestamp === undefined
        ) {
          throw new Error(
            'Expected every event timestamp to be defined.',
          );
        }

        expect(currentTimestamp).toBeGreaterThanOrEqual(
          previousTimestamp,
        );
      }
    });
  });

  describe('event version invariants', () => {
    it('assigns a valid event version to the CourseCreated event', () => {
      const course = createCourse();
      const event = getSingleEvent(course);

      expect(event.eventVersion).toBe(1);
    });

    it('assigns event version one to every current Course event', () => {
      const course = createCourse();

      const createdEvent = getSingleEvent(course);

      course.updateMetadata({
        title: 'Updated Course',
      });

      const metadataEvent = getSingleEvent(course);

      course.submitForReview();

      const reviewEvent = getSingleEvent(course);

      course.publish();

      const publishedEvent = getSingleEvent(course);

      course.unpublish();

      const unpublishedEvent = getSingleEvent(course);

      course.archive();

      const archivedEvent = getSingleEvent(course);

      expect([
        createdEvent.eventVersion,
        metadataEvent.eventVersion,
        reviewEvent.eventVersion,
        publishedEvent.eventVersion,
        unpublishedEvent.eventVersion,
        archivedEvent.eventVersion,
      ]).toEqual([1, 1, 1, 1, 1, 1]);
    });
  });

  describe('event collection invariants', () => {
    it('returns a detached event collection from getDomainEvents', () => {
      const course = createCourse();

      const firstRead = course.getDomainEvents();
      const secondRead = course.getDomainEvents();

      expect(firstRead).not.toBe(secondRead);
      expect(firstRead).toEqual(secondRead);
    });

    it('does not consume events when getDomainEvents is called', () => {
      const course = createCourse();

      expect(course.getDomainEvents()).toHaveLength(1);
      expect(course.getDomainEvents()).toHaveLength(1);
    });

    it('consumes events exactly once through pullDomainEvents', () => {
      const course = createCourse();

      const firstPull = course.pullDomainEvents();
      const secondPull = course.pullDomainEvents();

      expect(firstPull).toHaveLength(1);
      expect(secondPull).toHaveLength(0);
    });

    it('returns a detached array from pullDomainEvents', () => {
      const course = createCourse();

      const pulledEvents = course.pullDomainEvents();

      pulledEvents.length = 0;

      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('allows new events to accumulate after events are pulled', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.updateMetadata({
        title: 'Updated Course',
      });

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe(
        'courses.course.metadata_updated',
      );
    });
  });

  describe('rehydration event invariants', () => {
    it('does not emit a creation event during rehydration', () => {
      const course = createCourse();

      const primitives = course.toPrimitives();
      const rehydrated = Course.rehydrate(primitives);

      expect(rehydrated.getDomainEvents()).toHaveLength(0);
    });

    it('does not duplicate historical events during rehydration', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Updated Course',
      });

      course.submitForReview();
      course.publish();

      const primitives = course.toPrimitives();
      const rehydrated = Course.rehydrate(primitives);

      expect(rehydrated.getDomainEvents()).toHaveLength(0);
    });

    it('starts a fresh event stream after rehydration when a new mutation occurs', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Updated Course',
      });

      const primitives = course.toPrimitives();
      const rehydrated = Course.rehydrate(primitives);

      expect(rehydrated.getDomainEvents()).toHaveLength(0);

      rehydrated.submitForReview();

      const events = rehydrated.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe(
        'courses.course.submitted_for_review',
      );
      expect(events[0]?.aggregateId).toBe(rehydrated.id.toString());
    });
  });
});