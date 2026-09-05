import { describe, expect, it } from 'vitest';

import { Course } from './course.js';

import { CourseLevel } from '../enums/course-level.js';
import { CourseStatus } from '../enums/course-status.js';
import { CourseType } from '../enums/course-type.js';
import { CourseVisibility } from '../enums/course-visibility.js';
import { CourseDomainEventName } from '../events/course.events.js';

import { InvalidCourseStateTransitionError } from '../errors/index.js';

const createCourse = (): Course =>
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

const moveToUnpublished = (course: Course): void => {
  moveToPublished(course);
  course.unpublish();
};

const moveToArchived = (course: Course): void => {
  moveToPublished(course);
  course.archive();
};

describe('Course lifecycle transition atomicity', () => {
  describe('successful transition state boundaries', () => {
    it('preserves createdAt when submitting for review', () => {
      const course = createCourse();
      const createdAt = course.createdAt;

      course.submitForReview();

      expect(course.createdAt).toEqual(createdAt);
    });

    it('preserves createdAt when publishing', () => {
      const course = createCourse();

      course.submitForReview();

      const createdAt = course.createdAt;

      course.publish();

      expect(course.createdAt).toEqual(createdAt);
    });

    it('preserves createdAt when unpublishing', () => {
      const course = createCourse();

      moveToPublished(course);

      const createdAt = course.createdAt;

      course.unpublish();

      expect(course.createdAt).toEqual(createdAt);
    });

    it('preserves createdAt when archiving', () => {
      const course = createCourse();

      moveToPublished(course);

      const createdAt = course.createdAt;

      course.archive();

      expect(course.createdAt).toEqual(createdAt);
    });

    it('never moves updatedAt backwards during the complete lifecycle', () => {
      const course = createCourse();

      let previousUpdatedAt = course.updatedAt.getTime();

      course.submitForReview();

      expect(course.updatedAt.getTime()).toBeGreaterThanOrEqual(
        previousUpdatedAt,
      );

      previousUpdatedAt = course.updatedAt.getTime();

      course.publish();

      expect(course.updatedAt.getTime()).toBeGreaterThanOrEqual(
        previousUpdatedAt,
      );

      previousUpdatedAt = course.updatedAt.getTime();

      course.unpublish();

      expect(course.updatedAt.getTime()).toBeGreaterThanOrEqual(
        previousUpdatedAt,
      );

      previousUpdatedAt = course.updatedAt.getTime();

      course.archive();

      expect(course.updatedAt.getTime()).toBeGreaterThanOrEqual(
        previousUpdatedAt,
      );
    });

    it('preserves aggregate identity across the complete lifecycle', () => {
      const course = createCourse();
      const originalId = course.id;

      course.submitForReview();
      expect(course.id).toBe(originalId);

      course.publish();
      expect(course.id).toBe(originalId);

      course.unpublish();
      expect(course.id).toBe(originalId);

      course.archive();
      expect(course.id).toBe(originalId);
    });

    it('preserves instructor ownership across the complete lifecycle', () => {
      const course = createCourse();
      const originalInstructorId = course.instructorId;

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      expect(course.instructorId).toBe(originalInstructorId);
    });

    it('preserves metadata across the complete lifecycle', () => {
      const course = createCourse();

      const original = {
        title: course.title,
        description: course.description,
        level: course.level,
        type: course.type,
        visibility: course.visibility,
      };

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      expect(course.title).toBe(original.title);
      expect(course.description).toBe(original.description);
      expect(course.level).toBe(original.level);
      expect(course.type).toBe(original.type);
      expect(course.visibility).toBe(original.visibility);
    });
  });

  describe('successful transition event boundaries', () => {
    it('emits exactly one event for DRAFT → IN_REVIEW', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();

      const [event] = course.getDomainEvents();

      expect(course.getDomainEvents()).toHaveLength(1);
      expect(event?.eventName).toBe(
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
      );
      expect(event?.aggregateId).toBe(course.id.toString());
    });

    it('emits exactly one event for IN_REVIEW → PUBLISHED', () => {
      const course = createCourse();

      course.submitForReview();
      course.pullDomainEvents();

      course.publish();

      const [event] = course.getDomainEvents();

      expect(course.getDomainEvents()).toHaveLength(1);
      expect(event?.eventName).toBe(CourseDomainEventName.PUBLISHED);
      expect(event?.aggregateId).toBe(course.id.toString());
    });

    it('emits exactly one event for PUBLISHED → UNPUBLISHED', () => {
      const course = createCourse();

      moveToPublished(course);
      course.pullDomainEvents();

      course.unpublish();

      const [event] = course.getDomainEvents();

      expect(course.getDomainEvents()).toHaveLength(1);
      expect(event?.eventName).toBe(CourseDomainEventName.UNPUBLISHED);
      expect(event?.aggregateId).toBe(course.id.toString());
    });

    it('emits exactly one event for PUBLISHED → ARCHIVED', () => {
      const course = createCourse();

      moveToPublished(course);
      course.pullDomainEvents();

      course.archive();

      const [event] = course.getDomainEvents();

      expect(course.getDomainEvents()).toHaveLength(1);
      expect(event?.eventName).toBe(CourseDomainEventName.ARCHIVED);
      expect(event?.aggregateId).toBe(course.id.toString());
    });

    it('emits exactly one event for UNPUBLISHED → ARCHIVED', () => {
      const course = createCourse();

      moveToUnpublished(course);
      course.pullDomainEvents();

      course.archive();

      const [event] = course.getDomainEvents();

      expect(course.getDomainEvents()).toHaveLength(1);
      expect(event?.eventName).toBe(CourseDomainEventName.ARCHIVED);
      expect(event?.aggregateId).toBe(course.id.toString());
    });

    it('keeps lifecycle event timestamps within aggregate time boundaries', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(4);

      for (const event of events) {
        expect(event.occurredAt.getTime()).toBeLessThanOrEqual(
          course.updatedAt.getTime(),
        );
      }
    });
  });

  describe('single rejected transition atomicity', () => {
    it('preserves status after rejection', () => {
      const course = createCourse();

      const status = course.status;

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(status);
    });

    it('preserves createdAt after rejection', () => {
      const course = createCourse();

      const createdAt = course.createdAt;

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.createdAt).toEqual(createdAt);
    });

    it('preserves updatedAt after rejection', () => {
      const course = createCourse();

      const updatedAt = course.updatedAt.getTime();

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.updatedAt.getTime()).toBe(updatedAt);
    });

    it('preserves identity after rejection', () => {
      const course = createCourse();

      const id = course.id;

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.id).toBe(id);
    });

    it('preserves metadata after rejection', () => {
      const course = createCourse();

      const metadata = {
        title: course.title,
        description: course.description,
        level: course.level,
        type: course.type,
        visibility: course.visibility,
        instructorId: course.instructorId,
      };

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.title).toBe(metadata.title);
      expect(course.description).toBe(metadata.description);
      expect(course.level).toBe(metadata.level);
      expect(course.type).toBe(metadata.type);
      expect(course.visibility).toBe(metadata.visibility);
      expect(course.instructorId).toBe(metadata.instructorId);
    });

    it('does not append an event after rejection', () => {
      const course = createCourse();

      course.pullDomainEvents();

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('multiple rejected transitions', () => {
    it('keeps DRAFT unchanged after multiple rejected operations', () => {
      const course = createCourse();

      course.pullDomainEvents();

      const createdAt = course.createdAt;
      const updatedAt = course.updatedAt.getTime();
      const id = course.id;

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );
      expect(() => course.unpublish()).toThrow(
        InvalidCourseStateTransitionError,
      );
      expect(() => course.archive()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.DRAFT);
      expect(course.createdAt).toEqual(createdAt);
      expect(course.updatedAt.getTime()).toBe(updatedAt);
      expect(course.id).toBe(id);
      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('keeps IN_REVIEW unchanged after multiple rejected operations', () => {
      const course = createCourse();

      course.submitForReview();
      course.pullDomainEvents();

      const createdAt = course.createdAt;
      const updatedAt = course.updatedAt.getTime();
      const id = course.id;

      expect(() => course.unpublish()).toThrow(
        InvalidCourseStateTransitionError,
      );
      expect(() => course.archive()).toThrow(
        InvalidCourseStateTransitionError,
      );
      expect(() => course.submitForReview()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.IN_REVIEW);
      expect(course.createdAt).toEqual(createdAt);
      expect(course.updatedAt.getTime()).toBe(updatedAt);
      expect(course.id).toBe(id);
      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('keeps PUBLISHED unchanged after multiple rejected operations', () => {
      const course = createCourse();

      moveToPublished(course);
      course.pullDomainEvents();

      const createdAt = course.createdAt;
      const updatedAt = course.updatedAt.getTime();
      const id = course.id;

      expect(() => course.submitForReview()).toThrow(
        InvalidCourseStateTransitionError,
      );
      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.PUBLISHED);
      expect(course.createdAt).toEqual(createdAt);
      expect(course.updatedAt.getTime()).toBe(updatedAt);
      expect(course.id).toBe(id);
      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('keeps UNPUBLISHED unchanged after multiple rejected operations', () => {
      const course = createCourse();

      moveToUnpublished(course);
      course.pullDomainEvents();

      const createdAt = course.createdAt;
      const updatedAt = course.updatedAt.getTime();
      const id = course.id;

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );
      expect(() => course.submitForReview()).toThrow(
        InvalidCourseStateTransitionError,
      );
      expect(() => course.unpublish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.UNPUBLISHED);
      expect(course.createdAt).toEqual(createdAt);
      expect(course.updatedAt.getTime()).toBe(updatedAt);
      expect(course.id).toBe(id);
      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('keeps ARCHIVED unchanged after multiple rejected operations', () => {
      const course = createCourse();

      moveToArchived(course);
      course.pullDomainEvents();

      const createdAt = course.createdAt;
      const updatedAt = course.updatedAt.getTime();
      const id = course.id;

      expect(() => course.submitForReview()).toThrow(
        InvalidCourseStateTransitionError,
      );
      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );
      expect(() => course.unpublish()).toThrow(
        InvalidCourseStateTransitionError,
      );
      expect(() => course.archive()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.ARCHIVED);
      expect(course.createdAt).toEqual(createdAt);
      expect(course.updatedAt.getTime()).toBe(updatedAt);
      expect(course.id).toBe(id);
      expect(course.getDomainEvents()).toHaveLength(0);
    });
  });
});