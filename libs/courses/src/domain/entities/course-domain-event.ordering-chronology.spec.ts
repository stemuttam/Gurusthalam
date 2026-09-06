import { describe, expect, it } from 'vitest';
import { Course } from './course.js';
import { CourseLevel } from '../enums/course-level.js';
import { CourseType } from '../enums/course-type.js';
import { CourseVisibility } from '../enums/course-visibility.js';
import { CourseDomainEventName } from '../events/course.events.js';

const createCourse = () =>
  Course.create({
    title: 'TypeScript Fundamentals',
    description: 'Learn TypeScript from the ground up.',
    level: CourseLevel.BEGINNER,
    type: CourseType.SELF_PACED,
    visibility: CourseVisibility.PRIVATE,
    instructorId: 'instructor-123',
  });

const getEvents = (course: Course) => course.getDomainEvents();

const getEventNames = (course: Course) =>
  getEvents(course).map((event) => event.eventName);

const getEventAt = (course: Course, index: number) => {
  const event = getEvents(course)[index];

  expect.assert(event);

  return event;
};

const getEventTimestamps = (course: Course): number[] =>
  getEvents(course).map((event) => event.occurredAt.getTime());

describe('Course domain-event ordering and chronology', () => {
  describe('creation ordering', () => {
    it('records CREATED as the first domain event', () => {
      const course = createCourse();

      const eventNames = getEventNames(course);

      expect(eventNames[0]).toBe(CourseDomainEventName.CREATED);
    });

    it('creates no event before CREATED', () => {
      const course = createCourse();

      expect(getEvents(course)).toHaveLength(1);
    });

    it('records CREATED before every subsequent domain event', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Advanced TypeScript',
      });

      course.submitForReview();
      course.publish();

      const eventNames = getEventNames(course);

      expect(eventNames).toEqual([
        CourseDomainEventName.CREATED,
        CourseDomainEventName.METADATA_UPDATED,
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
        CourseDomainEventName.PUBLISHED,
      ]);
    });
  });

  describe('metadata event ordering', () => {
    it('records METADATA_UPDATED after CREATED', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Advanced TypeScript',
      });

      expect(getEventNames(course)).toEqual([
        CourseDomainEventName.CREATED,
        CourseDomainEventName.METADATA_UPDATED,
      ]);
    });

    it('does not insert METADATA_UPDATED before the mutation', () => {
      const course = createCourse();

      expect(getEventNames(course)).toEqual([
        CourseDomainEventName.CREATED,
      ]);

      course.updateMetadata({
        title: 'Advanced TypeScript',
      });

      expect(getEventNames(course)).toEqual([
        CourseDomainEventName.CREATED,
        CourseDomainEventName.METADATA_UPDATED,
      ]);
    });

    it('preserves earlier events when metadata is updated repeatedly', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Advanced TypeScript',
      });

      course.updateMetadata({
        description: 'Updated description.',
      });

      expect(getEventNames(course)).toEqual([
        CourseDomainEventName.CREATED,
        CourseDomainEventName.METADATA_UPDATED,
        CourseDomainEventName.METADATA_UPDATED,
      ]);
    });
  });

  describe('review-submission ordering', () => {
    it('records SUBMITTED_FOR_REVIEW after CREATED', () => {
      const course = createCourse();

      course.submitForReview();

      expect(getEventNames(course)).toEqual([
        CourseDomainEventName.CREATED,
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
      ]);
    });

    it('records submission after all prior metadata events', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Advanced TypeScript',
      });

      course.submitForReview();

      expect(getEventNames(course)).toEqual([
        CourseDomainEventName.CREATED,
        CourseDomainEventName.METADATA_UPDATED,
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
      ]);
    });

    it('places SUBMITTED_FOR_REVIEW as the final pending event after submission', () => {
      const course = createCourse();

      course.submitForReview();

      const events = getEvents(course);
      const lastEvent = events[events.length - 1];

      expect.assert(lastEvent);

      expect(lastEvent.eventName).toBe(
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
      );
    });
  });

  describe('publication ordering', () => {
    it('records PUBLISHED after SUBMITTED_FOR_REVIEW', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();

      expect(getEventNames(course)).toEqual([
        CourseDomainEventName.CREATED,
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
        CourseDomainEventName.PUBLISHED,
      ]);
    });

    it('places PUBLISHED as the final pending event after publication', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();

      const events = getEvents(course);
      const lastEvent = events[events.length - 1];

      expect.assert(lastEvent);

      expect(lastEvent.eventName).toBe(
        CourseDomainEventName.PUBLISHED,
      );
    });

    it('does not create PUBLISHED before submission', () => {
      const course = createCourse();

      expect(getEventNames(course)).not.toContain(
        CourseDomainEventName.PUBLISHED,
      );
    });
  });

  describe('full lifecycle ordering', () => {
    it('preserves the complete forward lifecycle event sequence', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Advanced TypeScript',
      });

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      expect(getEventNames(course)).toEqual([
        CourseDomainEventName.CREATED,
        CourseDomainEventName.METADATA_UPDATED,
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
        CourseDomainEventName.PUBLISHED,
        CourseDomainEventName.UNPUBLISHED,
        CourseDomainEventName.ARCHIVED,
      ]);
    });

    it('records UNPUBLISHED only after PUBLISHED', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();
      course.unpublish();

      expect(getEventNames(course)).toEqual([
        CourseDomainEventName.CREATED,
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
        CourseDomainEventName.PUBLISHED,
        CourseDomainEventName.UNPUBLISHED,
      ]);
    });

    it('records ARCHIVED only after UNPUBLISHED', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      expect(getEventNames(course)).toEqual([
        CourseDomainEventName.CREATED,
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
        CourseDomainEventName.PUBLISHED,
        CourseDomainEventName.UNPUBLISHED,
        CourseDomainEventName.ARCHIVED,
      ]);
    });

    it('keeps each lifecycle event in its operation order', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      const events = getEvents(course);

      const submitted = getEventAt(course, 1);
      const published = getEventAt(course, 2);
      const unpublished = getEventAt(course, 3);
      const archived = getEventAt(course, 4);

      expect(events).toHaveLength(5);

      expect(submitted.eventName).toBe(
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
      );

      expect(published.eventName).toBe(
        CourseDomainEventName.PUBLISHED,
      );

      expect(unpublished.eventName).toBe(
        CourseDomainEventName.UNPUBLISHED,
      );

      expect(archived.eventName).toBe(
        CourseDomainEventName.ARCHIVED,
      );
    });
  });

  describe('timestamp chronology', () => {
    it('records non-decreasing event timestamps', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Advanced TypeScript',
      });

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      const timestamps = getEventTimestamps(course);

      expect(timestamps.length).toBeGreaterThan(0);

      for (let index = 1; index < timestamps.length; index += 1) {
        const previousTimestamp = timestamps[index - 1];
        const currentTimestamp = timestamps[index];

        expect.assert(previousTimestamp !== undefined);
        expect.assert(currentTimestamp !== undefined);

        expect(currentTimestamp).toBeGreaterThanOrEqual(
          previousTimestamp,
        );
      }
    });

    it('does not record an event after the aggregate updatedAt timestamp', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Advanced TypeScript',
      });

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      const aggregateTimestamp = course.updatedAt.getTime();

      for (const event of getEvents(course)) {
        expect(event.occurredAt.getTime()).toBeLessThanOrEqual(
          aggregateTimestamp,
        );
      }
    });

    it('records each lifecycle event at the aggregate updatedAt timestamp', () => {
      const course = createCourse();

      course.submitForReview();
      const submitted = getEventAt(course, 1);

      expect(submitted.occurredAt.getTime()).toBe(
        course.updatedAt.getTime(),
      );

      course.publish();
      const published = getEventAt(course, 2);

      expect(published.occurredAt.getTime()).toBe(
        course.updatedAt.getTime(),
      );

      course.unpublish();
      const unpublished = getEventAt(course, 3);

      expect(unpublished.occurredAt.getTime()).toBe(
        course.updatedAt.getTime(),
      );

      course.archive();
      const archived = getEventAt(course, 4);

      expect(archived.occurredAt.getTime()).toBe(
        course.updatedAt.getTime(),
      );
    });
  });

  describe('repeated reads', () => {
    it('preserves event ordering across repeated reads', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      const firstRead = getEventNames(course);
      const secondRead = getEventNames(course);
      const thirdRead = getEventNames(course);

      expect(secondRead).toEqual(firstRead);
      expect(thirdRead).toEqual(firstRead);
    });

    it('preserves event IDs across repeated reads', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      const firstRead = getEvents(course);
      const secondRead = getEvents(course);

      expect(secondRead.map((event) => event.eventId)).toEqual(
        firstRead.map((event) => event.eventId),
      );
    });
  });

  describe('rejected transition chronology', () => {
    it('does not alter event history when publication is rejected', () => {
      const course = createCourse();

      const beforeAttempt = getEvents(course);

      expect(() => course.publish()).toThrow();

      const afterAttempt = getEvents(course);

      expect(afterAttempt).toEqual(beforeAttempt);
    });

    it('does not alter event history when repeated publication is rejected', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();

      const beforeAttempt = getEvents(course);

      expect(() => course.publish()).toThrow();

      const afterAttempt = getEvents(course);

      expect(afterAttempt).toEqual(beforeAttempt);
    });

    it('does not append an unrelated event after a rejected transition', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();

      expect(() => course.publish()).toThrow();

      expect(getEventNames(course)).toEqual([
        CourseDomainEventName.CREATED,
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
        CourseDomainEventName.PUBLISHED,
      ]);
    });
  });
});