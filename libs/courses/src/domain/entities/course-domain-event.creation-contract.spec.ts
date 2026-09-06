import { describe, expect, it } from 'vitest';
import { Course } from './course.js';
import { CourseLevel } from '../enums/course-level.js';
import { CourseStatus } from '../enums/course-status.js';
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

describe('Course domain-event creation contract', () => {
  describe('Course.create()', () => {
    it('creates exactly one domain event', () => {
      const course = createCourse();

      expect(getEvents(course)).toHaveLength(1);
    });

    it('creates the canonical CREATED event', () => {
      const course = createCourse();

      expect(getEventNames(course)).toEqual([
        CourseDomainEventName.CREATED,
      ]);
    });

    it('uses the aggregate Course ID', () => {
      const course = createCourse();
      const event = getEventAt(course, 0);

      expect(event.aggregateId).toBe(course.id.value);
      expect(event.payload.courseId).toBe(course.id.value);
    });

    it('uses event version 1', () => {
      const course = createCourse();
      const event = getEventAt(course, 0);

      expect(event.eventVersion).toBe(1);
    });

    it('creates a non-empty event ID', () => {
      const course = createCourse();
      const event = getEventAt(course, 0);

      expect(event.eventId).toEqual(expect.any(String));
      expect(event.eventId.trim().length).toBeGreaterThan(0);
    });

    it('uses the aggregate updatedAt timestamp for creation', () => {
      const course = createCourse();
      const event = getEventAt(course, 0);

      expect(event.occurredAt.getTime()).toBe(
        course.updatedAt.getTime(),
      );
    });

    it('contains the complete creation payload', () => {
      const course = createCourse();
      const event = getEventAt(course, 0);

      expect(event.payload).toEqual({
        courseId: course.id.value,
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

  describe('updateMetadata()', () => {
    it('adds exactly one metadata-updated event', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Advanced TypeScript',
      });

      expect(getEvents(course)).toHaveLength(2);
    });

    it('uses the canonical METADATA_UPDATED event', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Advanced TypeScript',
      });

      expect(getEventNames(course)).toEqual([
        CourseDomainEventName.CREATED,
        CourseDomainEventName.METADATA_UPDATED,
      ]);
    });

    it('uses the aggregate ID', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Advanced TypeScript',
      });

      const event = getEventAt(course, 1);

      expect(event.aggregateId).toBe(course.id.value);
      expect(event.payload.courseId).toBe(course.id.value);
    });

    it('uses event version 1', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Advanced TypeScript',
      });

      const event = getEventAt(course, 1);

      expect(event.eventVersion).toBe(1);
    });

    it('uses the aggregate updatedAt timestamp', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Advanced TypeScript',
      });

      const event = getEventAt(course, 1);

      expect(event.occurredAt.getTime()).toBe(
        course.updatedAt.getTime(),
      );
    });

    it('contains the updated metadata payload', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Advanced TypeScript',
        description: 'Updated course description.',
      });

      const event = getEventAt(course, 1);

      expect(event.payload).toEqual({
        courseId: course.id.value,
        title: 'Advanced TypeScript',
        description: 'Updated course description.',
        level: course.level,
        type: course.type,
        visibility: course.visibility,
      });
    });
  });

  describe('submitForReview()', () => {
    it('adds exactly one submitted-for-review event', () => {
      const course = createCourse();

      course.submitForReview();

      expect(getEvents(course)).toHaveLength(2);
    });

    it('uses the canonical SUBMITTED_FOR_REVIEW event', () => {
      const course = createCourse();

      course.submitForReview();

      expect(getEventNames(course)).toEqual([
        CourseDomainEventName.CREATED,
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
      ]);
    });

    it('contains the correct lifecycle payload', () => {
      const course = createCourse();

      course.submitForReview();

      const event = getEventAt(course, 1);

      expect(event.payload).toEqual({
        courseId: course.id.value,
        previousStatus: CourseStatus.DRAFT,
        currentStatus: CourseStatus.IN_REVIEW,
      });
    });

    it('uses the aggregate ID and version 1', () => {
      const course = createCourse();

      course.submitForReview();

      const event = getEventAt(course, 1);

      expect(event.aggregateId).toBe(course.id.value);
      expect(event.eventVersion).toBe(1);
    });

    it('uses the aggregate updatedAt timestamp', () => {
      const course = createCourse();

      course.submitForReview();

      const event = getEventAt(course, 1);

      expect(event.occurredAt.getTime()).toBe(
        course.updatedAt.getTime(),
      );
    });
  });

  describe('publish()', () => {
    it('adds exactly one published event', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();

      const events = getEvents(course);

      expect(
        events.filter(
          (event) =>
            event.eventName === CourseDomainEventName.PUBLISHED,
        ),
      ).toHaveLength(1);
    });

    it('uses the canonical PUBLISHED event', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();

      expect(getEventNames(course)).toEqual([
        CourseDomainEventName.CREATED,
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
        CourseDomainEventName.PUBLISHED,
      ]);
    });

    it('contains the correct lifecycle payload', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();

      const event = getEventAt(course, 2);

      expect(event.payload).toEqual({
        courseId: course.id.value,
        previousStatus: CourseStatus.IN_REVIEW,
        currentStatus: CourseStatus.PUBLISHED,
      });
    });

    it('uses the aggregate ID and version 1', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();

      const event = getEventAt(course, 2);

      expect(event.aggregateId).toBe(course.id.value);
      expect(event.eventVersion).toBe(1);
    });

    it('uses the aggregate updatedAt timestamp', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();

      const event = getEventAt(course, 2);

      expect(event.occurredAt.getTime()).toBe(
        course.updatedAt.getTime(),
      );
    });
  });

  describe('event identity', () => {
    it('assigns unique event IDs to different domain events', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Advanced TypeScript',
      });

      course.submitForReview();
      course.publish();

      const events = getEvents(course);
      const eventIds = events.map((event) => event.eventId);

      expect(new Set(eventIds).size).toBe(eventIds.length);
    });

    it('preserves event identity across repeated reads', () => {
      const course = createCourse();

      course.submitForReview();

      const firstRead = getEvents(course);
      const secondRead = getEvents(course);

      expect(
        secondRead.map((event) => event.eventId),
      ).toEqual(firstRead.map((event) => event.eventId));
    });
  });

  describe('event chronology', () => {
    it('preserves domain-event creation order', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Advanced TypeScript',
      });

      course.submitForReview();
      course.publish();

      expect(getEventNames(course)).toEqual([
        CourseDomainEventName.CREATED,
        CourseDomainEventName.METADATA_UPDATED,
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
        CourseDomainEventName.PUBLISHED,
      ]);
    });

    it('keeps event timestamps non-decreasing', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Advanced TypeScript',
      });

      course.submitForReview();
      course.publish();

      const timestamps = getEvents(course).map((event) =>
        event.occurredAt.getTime(),
      );

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
  });
});