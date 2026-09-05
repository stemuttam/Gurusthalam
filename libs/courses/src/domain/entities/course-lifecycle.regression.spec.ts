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

const moveToReview = (course: Course): void => {
  course.submitForReview();
};

const moveToPublished = (course: Course): void => {
  moveToReview(course);
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

describe('Course lifecycle final regression', () => {
  describe('complete valid lifecycle', () => {
    it('supports the complete valid lifecycle', () => {
      const course = createCourse();

      expect(course.status).toBe(CourseStatus.DRAFT);

      course.submitForReview();
      expect(course.status).toBe(CourseStatus.IN_REVIEW);

      course.publish();
      expect(course.status).toBe(CourseStatus.PUBLISHED);

      course.unpublish();
      expect(course.status).toBe(CourseStatus.UNPUBLISHED);

      course.archive();
      expect(course.status).toBe(CourseStatus.ARCHIVED);
    });

    it('preserves aggregate identity across the complete lifecycle', () => {
      const course = createCourse();
      const originalId = course.id;

      course.submitForReview();
      course.publish();
      course.unpublish();
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

      const originalMetadata = {
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

      expect({
        title: course.title,
        description: course.description,
        level: course.level,
        type: course.type,
        visibility: course.visibility,
      }).toEqual(originalMetadata);
    });

    it('preserves createdAt across the complete lifecycle', () => {
      const course = createCourse();
      const createdAt = course.createdAt;

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      expect(course.createdAt).toEqual(createdAt);
    });

    it('keeps updatedAt monotonic across the complete lifecycle', () => {
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
  });

  describe('complete lifecycle event regression', () => {
    it('produces exactly the expected lifecycle event sequence', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(4);

      expect(events.map((event) => event.eventName)).toEqual([
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
        CourseDomainEventName.PUBLISHED,
        CourseDomainEventName.UNPUBLISHED,
        CourseDomainEventName.ARCHIVED,
      ]);
    });

    it('preserves aggregate identity across every lifecycle event', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      const events = course.getDomainEvents();

      for (const event of events) {
        expect(event.aggregateId).toBe(course.id.toString());
      }
    });

    it('uses event version 1 across the lifecycle', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      const events = course.getDomainEvents();

      for (const event of events) {
        expect(event.eventVersion).toBe(1);
      }
    });

    it('uses unique event ids across the lifecycle', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      const eventIds = course
        .getDomainEvents()
        .map((event) => event.eventId);

      expect(eventIds).toHaveLength(4);
      expect(new Set(eventIds).size).toBe(4);
    });

    it('keeps lifecycle event timestamps within aggregate time boundaries', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      const events = course.getDomainEvents();

      for (const event of events) {
        expect(event.occurredAt.getTime()).toBeLessThanOrEqual(
          course.updatedAt.getTime(),
        );
      }
    });
  });

  describe('invalid transition regression', () => {
    it('rejects every invalid transition from DRAFT', () => {
      const course = createCourse();
      course.pullDomainEvents();

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
      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('rejects every invalid transition from IN_REVIEW', () => {
      const course = createCourse();

      course.submitForReview();
      course.pullDomainEvents();

      expect(() => course.publish()).not.toThrow();

      const publishedCourse = course;

      expect(publishedCourse.status).toBe(CourseStatus.PUBLISHED);
    });

    it('rejects invalid transitions from PUBLISHED', () => {
      const course = createCourse();

      moveToPublished(course);
      course.pullDomainEvents();

      expect(() => course.submitForReview()).toThrow(
        InvalidCourseStateTransitionError,
      );
      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.PUBLISHED);
      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('rejects invalid transitions from UNPUBLISHED', () => {
      const course = createCourse();

      moveToUnpublished(course);
      course.pullDomainEvents();

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
      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('rejects every transition from ARCHIVED', () => {
      const course = createCourse();

      moveToArchived(course);
      course.pullDomainEvents();

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
      expect(course.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('rejected transition atomicity regression', () => {
    it('preserves the complete aggregate state after rejection', () => {
      const course = createCourse();
      course.pullDomainEvents();

      const snapshot = {
        id: course.id,
        instructorId: course.instructorId,
        title: course.title,
        description: course.description,
        level: course.level,
        type: course.type,
        visibility: course.visibility,
        status: course.status,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt,
      };

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect({
        id: course.id,
        instructorId: course.instructorId,
        title: course.title,
        description: course.description,
        level: course.level,
        type: course.type,
        visibility: course.visibility,
        status: course.status,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt,
      }).toEqual(snapshot);

      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('does not change updatedAt after repeated rejected transitions', () => {
      const course = createCourse();
      course.pullDomainEvents();

      const updatedAt = course.updatedAt.getTime();

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );
      expect(() => course.unpublish()).toThrow(
        InvalidCourseStateTransitionError,
      );
      expect(() => course.archive()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.updatedAt.getTime()).toBe(updatedAt);
    });
  });

  describe('event queue regression', () => {
    it('does not leak the creation event into lifecycle-only assertions after pull', () => {
      const course = createCourse();

      const initialEvents = course.pullDomainEvents();

      expect(initialEvents).toHaveLength(1);
      expect(initialEvents[0]?.eventName).toBe(
        CourseDomainEventName.CREATED,
      );

      expect(course.getDomainEvents()).toHaveLength(0);

      course.submitForReview();

      const lifecycleEvents = course.getDomainEvents();

      expect(lifecycleEvents).toHaveLength(1);
      expect(lifecycleEvents[0]?.eventName).toBe(
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
      );
    });

    it('supports repeated pull-and-transition cycles', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();

      expect(course.pullDomainEvents()).toHaveLength(1);

      course.publish();

      expect(course.pullDomainEvents()).toHaveLength(1);

      course.unpublish();

      expect(course.pullDomainEvents()).toHaveLength(1);

      course.archive();

      const finalEvents = course.pullDomainEvents();

      expect(finalEvents).toHaveLength(1);
      expect(finalEvents[0]?.eventName).toBe(
        CourseDomainEventName.ARCHIVED,
      );

      expect(course.getDomainEvents()).toHaveLength(0);
      expect(course.status).toBe(CourseStatus.ARCHIVED);
    });
  });

  describe('terminal-state regression', () => {
    it('keeps ARCHIVED terminal after all attempted transitions', () => {
      const course = createCourse();

      moveToArchived(course);
      course.pullDomainEvents();

      const archivedAt = course.updatedAt;
      const createdAt = course.createdAt;
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
      expect(course.id).toBe(id);
      expect(course.createdAt).toEqual(createdAt);
      expect(course.updatedAt).toEqual(archivedAt);
      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('preserves metadata after reaching ARCHIVED', () => {
      const course = createCourse();

      const metadata = {
        title: course.title,
        description: course.description,
        level: course.level,
        type: course.type,
        visibility: course.visibility,
      };

      moveToArchived(course);

      expect({
        title: course.title,
        description: course.description,
        level: course.level,
        type: course.type,
        visibility: course.visibility,
      }).toEqual(metadata);
    });
  });
});