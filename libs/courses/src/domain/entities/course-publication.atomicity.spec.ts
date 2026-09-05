import { describe, expect, it } from 'vitest';

import { Course } from './course.js';

import { CourseLevel } from '../enums/course-level.js';
import { CourseStatus } from '../enums/course-status.js';
import { CourseType } from '../enums/course-type.js';
import { CourseVisibility } from '../enums/course-visibility.js';

import { InvalidCourseStateTransitionError } from '../errors/index.js';

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

const getPublishedEvents = (course: Course) =>
  course
    .getDomainEvents()
    .filter(
      (event) => event.eventName === CourseDomainEventName.PUBLISHED,
    );

describe('Course publication atomicity', () => {
  describe('rejected publication', () => {
    it('does not mutate status when publication is attempted from DRAFT', () => {
      const course = createCourse();

      const before = course.toPrimitives();

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      const after = course.toPrimitives();

      expect(after.status).toBe(CourseStatus.DRAFT);
      expect(after.status).toBe(before.status);
    });

    it('does not mutate metadata when publication is rejected', () => {
      const course = createCourse();

      const before = course.toPrimitives();

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      const after = course.toPrimitives();

      expect(after.title).toBe(before.title);
      expect(after.description).toBe(before.description);
      expect(after.level).toBe(before.level);
      expect(after.type).toBe(before.type);
      expect(after.visibility).toBe(before.visibility);
      expect(after.instructorId).toBe(before.instructorId);
    });

    it('does not mutate identity when publication is rejected', () => {
      const course = createCourse();

      const before = course.id.toString();

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.id.toString()).toBe(before);
    });

    it('does not mutate createdAt when publication is rejected', () => {
      const course = createCourse();

      const before = course.createdAt;

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.createdAt).toEqual(before);
    });

    it('does not mutate updatedAt when publication is rejected', () => {
      const course = createCourse();

      const before = course.updatedAt;

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.updatedAt).toEqual(before);
    });

    it('does not emit a PUBLISHED event when publication is rejected', () => {
      const course = createCourse();

      const eventsBefore = course.getDomainEvents();

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      const eventsAfter = course.getDomainEvents();

      expect(eventsAfter).toEqual(eventsBefore);
      expect(getPublishedEvents(course)).toHaveLength(0);
    });

    it('does not clear or reorder existing pending events when publication is rejected', () => {
      const course = createCourse();

      course.submitForReview();

      /*
       * Move back to a known valid aggregate boundary by capturing
       * the event collection immediately before the rejected operation.
       *
       * The second publish attempt is invalid because the first publish
       * already moved the aggregate to PUBLISHED.
       */
      course.publish();

      const eventsBefore = course.getDomainEvents();

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.getDomainEvents()).toEqual(eventsBefore);
    });

    it('keeps the aggregate usable after a rejected publication', () => {
      const course = createCourse();

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.DRAFT);
      expect(course.id.toString()).toBeTypeOf('string');
      expect(course.title).toBe('TypeScript Fundamentals');

      course.submitForReview();
      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
      expect(getPublishedEvents(course)).toHaveLength(1);
    });
  });

  describe('successful publication', () => {
    it('changes only the intended lifecycle status', () => {
      const course = createCourse();

      course.submitForReview();

      const before = course.toPrimitives();

      course.publish();

      const after = course.toPrimitives();

      expect(after.id).toEqual(before.id);
      expect(after.title).toBe(before.title);
      expect(after.description).toBe(before.description);
      expect(after.level).toBe(before.level);
      expect(after.type).toBe(before.type);
      expect(after.visibility).toBe(before.visibility);
      expect(after.instructorId).toBe(before.instructorId);
      expect(after.createdAt).toEqual(before.createdAt);
      expect(after.status).toBe(CourseStatus.PUBLISHED);
    });

    it('updates updatedAt when publication succeeds', () => {
      const course = createCourse();

      course.submitForReview();

      const beforePublish = course.updatedAt;

      course.publish();

      const afterPublish = course.updatedAt;

      expect(afterPublish.getTime()).toBeGreaterThanOrEqual(
        beforePublish.getTime(),
      );
    });

    it('records exactly one PUBLISHED event for one successful publication', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();

      expect(getPublishedEvents(course)).toHaveLength(1);
    });

    it('records the correct publication event payload', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();

      const [publishedEvent] = getPublishedEvents(course);

      expect(publishedEvent).toBeDefined();

      expect(publishedEvent?.aggregateId).toBe(course.id.toString());

      expect(publishedEvent?.payload).toMatchObject({
        courseId: course.id.toString(),
        previousStatus: CourseStatus.IN_REVIEW,
        currentStatus: CourseStatus.PUBLISHED,
      });
    });

    it('keeps the aggregate usable after successful publication', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
      expect(course.id.toString()).toBeTypeOf('string');
      expect(course.title).toBe('TypeScript Fundamentals');
      expect(course.description).toBe(
        'Learn TypeScript from the ground up.',
      );
    });
  });

  describe('publication is a one-way atomic transition', () => {
    it('does not create a second PUBLISHED event after a repeated publish attempt', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();

      const eventsBefore = course.getDomainEvents();

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.getDomainEvents()).toEqual(eventsBefore);
      expect(getPublishedEvents(course)).toHaveLength(1);
    });

    it('preserves PUBLISHED status after a rejected repeated publication', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.PUBLISHED);
    });

    it('preserves the complete aggregate snapshot after a rejected repeated publication', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();

      const before = course.toPrimitives();
      const eventsBefore = course.getDomainEvents();

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.toPrimitives()).toEqual(before);
      expect(course.getDomainEvents()).toEqual(eventsBefore);
    });
  });
});