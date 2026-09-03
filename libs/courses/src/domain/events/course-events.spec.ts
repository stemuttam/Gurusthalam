import { describe, expect, it } from 'vitest';

import { Course } from '../entities/course.js';
import { CourseLevel } from '../enums/course-level.js';
import { CourseStatus } from '../enums/course-status.js';
import { CourseType } from '../enums/course-type.js';
import { CourseVisibility } from '../enums/course-visibility.js';

import { CourseDomainEventName } from './course.events.js';

const createCourse = () =>
  Course.create({
    title: 'TypeScript Fundamentals',
    description: 'Learn TypeScript from the ground up.',
    level: CourseLevel.BEGINNER,
    type: CourseType.SELF_PACED,
    visibility: CourseVisibility.PRIVATE,
    instructorId: 'instructor-123',
  });

describe('Course domain events', () => {
  describe('Course.create()', () => {
    it('records exactly one CourseCreated event', () => {
      const course = createCourse();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe(
        CourseDomainEventName.CREATED,
      );
    });

    it('records the correct aggregate identifier', () => {
      const course = createCourse();

      const [event] = course.getDomainEvents();

      expect(event?.aggregateId).toBe(course.id.toString());
      expect(event?.payload.courseId).toBe(
        course.id.toString(),
      );
    });

    it('records event version 1', () => {
      const course = createCourse();

      const [event] = course.getDomainEvents();

      expect(event?.eventVersion).toBe(1);
    });

    it('records a valid event identifier', () => {
      const course = createCourse();

      const [event] = course.getDomainEvents();

      expect(event?.eventId).toEqual(expect.any(String));
      expect(event?.eventId.length).toBeGreaterThan(0);
    });

    it('records a valid occurrence timestamp', () => {
      const course = createCourse();

      const [event] = course.getDomainEvents();

      expect(event?.occurredAt).toBeInstanceOf(Date);
      expect(event?.occurredAt.getTime()).not.toBeNaN();
    });

    it('records the course snapshot in the event payload', () => {
      const course = createCourse();

      const [event] = course.getDomainEvents();

      expect(event?.payload).toEqual({
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

  describe('getDomainEvents()', () => {
    it('does not clear pending events', () => {
      const course = createCourse();

      const firstRead = course.getDomainEvents();
      const secondRead = course.getDomainEvents();

      expect(firstRead).toHaveLength(1);
      expect(secondRead).toHaveLength(1);
      expect(secondRead[0]?.eventId).toBe(
        firstRead[0]?.eventId,
      );
    });

    it('returns a new array instead of exposing the internal collection', () => {
      const course = createCourse();

      const firstRead = course.getDomainEvents();
      const secondRead = course.getDomainEvents();

      expect(firstRead).not.toBe(secondRead);
      expect(firstRead).toEqual(secondRead);
    });
  });

  describe('updateMetadata()', () => {
    it('records CourseMetadataUpdated after a successful update', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.updateMetadata({
        title: 'Advanced TypeScript',
        description: 'Updated course description.',
        level: CourseLevel.INTERMEDIATE,
        type: CourseType.BLENDED,
        visibility: CourseVisibility.PUBLIC,
      });

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe(
        CourseDomainEventName.METADATA_UPDATED,
      );
    });

    it('records the updated metadata in the payload', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.updateMetadata({
        title: 'Advanced TypeScript',
        description: 'Updated course description.',
        level: CourseLevel.INTERMEDIATE,
        type: CourseType.BLENDED,
        visibility: CourseVisibility.PUBLIC,
      });

      const [event] = course.getDomainEvents();

      expect(event?.payload).toEqual({
        courseId: course.id.toString(),
        title: 'Advanced TypeScript',
        description: 'Updated course description.',
        level: CourseLevel.INTERMEDIATE,
        type: CourseType.BLENDED,
        visibility: CourseVisibility.PUBLIC,
      });
    });

    it('does not create an event when metadata validation fails', () => {
      const course = createCourse();

      course.pullDomainEvents();

      expect(() =>
        course.updateMetadata({
          title: '   ',
        }),
      ).toThrow();

      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('does not create an event when metadata mutation is not allowed', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();

      course.pullDomainEvents();

      expect(() =>
        course.updateMetadata({
          title: 'Should Not Change',
        }),
      ).toThrow();

      expect(course.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('submitForReview()', () => {
    it('records CourseSubmittedForReview', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();

      const [event] = course.getDomainEvents();

      expect(event?.eventName).toBe(
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
      );
    });

    it('records the status transition', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();

      const [event] = course.getDomainEvents();

      expect(event?.payload).toEqual({
        courseId: course.id.toString(),
        previousStatus: CourseStatus.DRAFT,
        currentStatus: CourseStatus.IN_REVIEW,
      });
    });

    it('does not create an event for an invalid transition', () => {
      const course = createCourse();

      course.pullDomainEvents();
      course.submitForReview();
      course.pullDomainEvents();

      expect(() => course.submitForReview()).toThrow();

      expect(course.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('publish()', () => {
    it('records CoursePublished', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();
      course.pullDomainEvents();

      course.publish();

      const [event] = course.getDomainEvents();

      expect(event?.eventName).toBe(
        CourseDomainEventName.PUBLISHED,
      );
    });

    it('records the status transition', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();
      course.pullDomainEvents();

      course.publish();

      const [event] = course.getDomainEvents();

      expect(event?.payload).toEqual({
        courseId: course.id.toString(),
        previousStatus: CourseStatus.IN_REVIEW,
        currentStatus: CourseStatus.PUBLISHED,
      });
    });

    it('does not create an event when publishing is invalid', () => {
      const course = createCourse();

      course.pullDomainEvents();

      expect(() => course.publish()).toThrow();

      expect(course.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('unpublish()', () => {
    it('records CourseUnpublished', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();
      course.publish();

      course.pullDomainEvents();

      course.unpublish();

      const [event] = course.getDomainEvents();

      expect(event?.eventName).toBe(
        CourseDomainEventName.UNPUBLISHED,
      );
    });

    it('records the status transition', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();
      course.publish();

      course.pullDomainEvents();

      course.unpublish();

      const [event] = course.getDomainEvents();

      expect(event?.payload).toEqual({
        courseId: course.id.toString(),
        previousStatus: CourseStatus.PUBLISHED,
        currentStatus: CourseStatus.UNPUBLISHED,
      });
    });

    it('does not create an event for an invalid transition', () => {
      const course = createCourse();

      course.pullDomainEvents();

      expect(() => course.unpublish()).toThrow();

      expect(course.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('archive()', () => {
    it('records CourseArchived from PUBLISHED', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();
      course.publish();

      course.pullDomainEvents();

      course.archive();

      const [event] = course.getDomainEvents();

      expect(event?.eventName).toBe(
        CourseDomainEventName.ARCHIVED,
      );
    });

    it('records CourseArchived from UNPUBLISHED', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();
      course.publish();
      course.unpublish();

      course.pullDomainEvents();

      course.archive();

      const [event] = course.getDomainEvents();

      expect(event?.eventName).toBe(
        CourseDomainEventName.ARCHIVED,
      );
    });

    it('does not create an event when archiving is invalid', () => {
      const course = createCourse();

      course.pullDomainEvents();

      expect(() => course.archive()).toThrow();

      expect(course.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('event ordering', () => {
    it('preserves event order within the aggregate', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      const events = course.getDomainEvents();

      expect(events.map((event) => event.eventName)).toEqual([
        CourseDomainEventName.CREATED,
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
        CourseDomainEventName.PUBLISHED,
        CourseDomainEventName.UNPUBLISHED,
        CourseDomainEventName.ARCHIVED,
      ]);
    });

    it('assigns unique event identifiers to separate events', () => {
      const course = createCourse();

      course.submitForReview();

      const events = course.getDomainEvents();

      expect(events[0]?.eventId).not.toBe(
        events[1]?.eventId,
      );
    });
  });

  describe('pullDomainEvents()', () => {
    it('returns all pending events', () => {
      const course = createCourse();

      course.submitForReview();

      const events = course.pullDomainEvents();

      expect(events).toHaveLength(2);

      expect(events[0]?.eventName).toBe(
        CourseDomainEventName.CREATED,
      );

      expect(events[1]?.eventName).toBe(
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
      );
    });

    it('clears the pending events after pulling', () => {
      const course = createCourse();

      course.pullDomainEvents();

      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('returns a new mutable array independent from aggregate state', () => {
      const course = createCourse();

      const events = course.pullDomainEvents();

      expect(events).toHaveLength(1);

      events.pop();

      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('allows subsequent operations to produce new pending events', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();

      expect(course.getDomainEvents()).toHaveLength(1);

      expect(course.getDomainEvents()[0]?.eventName).toBe(
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
      );
    });
  });

  describe('rehydrate()', () => {
    it('does not generate domain events', () => {
      const course = createCourse();

      const rehydrated = Course.rehydrate(
        course.toPrimitives(),
      );

      expect(rehydrated.getDomainEvents()).toHaveLength(0);
    });

    it('preserves the original aggregate identity', () => {
      const course = createCourse();

      const rehydrated = Course.rehydrate(
        course.toPrimitives(),
      );

      expect(rehydrated.id.equals(course.id)).toBe(true);
    });

    it('can subsequently generate events from new domain actions', () => {
      const course = createCourse();

      const rehydrated = Course.rehydrate(
        course.toPrimitives(),
      );

      rehydrated.submitForReview();

      const [event] = rehydrated.getDomainEvents();

      expect(event?.eventName).toBe(
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
      );
    });
  });
});