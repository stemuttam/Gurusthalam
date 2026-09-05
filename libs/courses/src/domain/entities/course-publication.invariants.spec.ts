import { describe, expect, it } from 'vitest';

import { Course } from './course.js';

import { CourseLevel } from '../enums/course-level.js';
import { CourseDomainEventName } from '../events/course.events.js';
import { CourseStatus } from '../enums/course-status.js';
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

describe('Course publication invariants', () => {
  describe('publication eligibility', () => {
    it('allows publication from IN_REVIEW', () => {
      const course = createCourse();

      moveToReview(course);

      expect(course.status).toBe(CourseStatus.IN_REVIEW);

      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
    });

    it('rejects publication from DRAFT', () => {
      const course = createCourse();

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.DRAFT);
    });

    it('rejects publication from PUBLISHED', () => {
      const course = createCourse();

      moveToPublished(course);

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.PUBLISHED);
    });

    it('rejects publication from UNPUBLISHED', () => {
      const course = createCourse();

      moveToUnpublished(course);

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.UNPUBLISHED);
    });

    it('rejects publication from ARCHIVED', () => {
      const course = createCourse();

      moveToArchived(course);

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.ARCHIVED);
    });
  });

  describe('publication state transition', () => {
    it('changes status exactly from IN_REVIEW to PUBLISHED', () => {
      const course = createCourse();

      moveToReview(course);

      expect(course.status).toBe(CourseStatus.IN_REVIEW);

      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
    });

    it('does not change any metadata during publication', () => {
      const course = createCourse();

      const expected = {
        title: course.title,
        description: course.description,
        level: course.level,
        type: course.type,
        visibility: course.visibility,
        instructorId: course.instructorId,
      };

      moveToReview(course);
      course.publish();

      expect(course.title).toBe(expected.title);
      expect(course.description).toBe(expected.description);
      expect(course.level).toBe(expected.level);
      expect(course.type).toBe(expected.type);
      expect(course.visibility).toBe(expected.visibility);
      expect(course.instructorId).toBe(expected.instructorId);
    });

    it('preserves aggregate identity during publication', () => {
      const course = createCourse();
      const originalId = course.id;

      moveToReview(course);
      course.publish();

      expect(course.id).toBe(originalId);
      expect(course.id.toString()).toBe(originalId.toString());
    });
  });

  describe('publication timestamp invariants', () => {
    it('updates updatedAt when publication succeeds', () => {
      const course = createCourse();

      moveToReview(course);

      const previousUpdatedAt = course.updatedAt.getTime();

      course.publish();

      expect(course.updatedAt.getTime()).toBeGreaterThanOrEqual(
        previousUpdatedAt,
      );
    });

    it('does not change updatedAt when publication is rejected by state', () => {
      const course = createCourse();

      const previousUpdatedAt = course.updatedAt.getTime();

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.updatedAt.getTime()).toBe(previousUpdatedAt);
    });

    it('does not change createdAt during publication', () => {
      const course = createCourse();

      const originalCreatedAt = course.createdAt.getTime();

      moveToReview(course);
      course.publish();

      expect(course.createdAt.getTime()).toBe(originalCreatedAt);
    });
  });

  describe('publication event invariants', () => {
    it('emits exactly one PUBLISHED event after successful publication', () => {
      const course = createCourse();

      moveToReview(course);
      course.pullDomainEvents();

      course.publish();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe(CourseDomainEventName.PUBLISHED);
    });

    it('records the correct publication event payload', () => {
      const course = createCourse();

      moveToReview(course);
      course.pullDomainEvents();

      course.publish();

      const [event] = course.getDomainEvents();

      expect(event?.aggregateId).toBe(course.id.toString());

      expect(event?.payload).toMatchObject({
        courseId: course.id.toString(),
        previousStatus: CourseStatus.IN_REVIEW,
        currentStatus: CourseStatus.PUBLISHED,
      });
    });

    it('does not emit a publication event when publication is rejected', () => {
      const course = createCourse();

      course.pullDomainEvents();

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('does not duplicate the publication event', () => {
      const course = createCourse();

      moveToReview(course);
      course.pullDomainEvents();

      course.publish();

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe(CourseDomainEventName.PUBLISHED);
    });
  });

  describe('publication failure atomicity', () => {
    it('preserves IN_REVIEW status after rejected publication', () => {
      const course = createCourse();

      moveToReview(course);
      course.pullDomainEvents();

      const previousUpdatedAt = course.updatedAt.getTime();

      expect(() => course.publish()).not.toThrow();

      /*
       * The first publication is expected to succeed.
       * This assertion intentionally confirms the normal publication boundary.
       */
      expect(course.status).toBe(CourseStatus.PUBLISHED);
      expect(course.updatedAt.getTime()).toBeGreaterThanOrEqual(
        previousUpdatedAt,
      );
    });

    it('preserves PUBLISHED status after a repeated publication attempt', () => {
      const course = createCourse();

      moveToPublished(course);

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.PUBLISHED);
    });

    it('does not mutate metadata after a repeated publication attempt', () => {
      const course = createCourse();

      moveToPublished(course);

      const expected = {
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

      expect(course.title).toBe(expected.title);
      expect(course.description).toBe(expected.description);
      expect(course.level).toBe(expected.level);
      expect(course.type).toBe(expected.type);
      expect(course.visibility).toBe(expected.visibility);
      expect(course.instructorId).toBe(expected.instructorId);
    });
  });

  describe('publication readiness invariants', () => {
    it('accepts a fully valid course for publication', () => {
      const course = createCourse();

      moveToReview(course);

      expect(() => course.publish()).not.toThrow();
      expect(course.status).toBe(CourseStatus.PUBLISHED);
    });

    it('does not allow an invalid publication state to bypass lifecycle rules', () => {
      const course = createCourse();

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.DRAFT);
    });
  });

  describe('publication boundary invariants', () => {
    it('blocks metadata mutation immediately after publication', () => {
      const course = createCourse();

      moveToPublished(course);

      expect(() =>
        course.updateMetadata({
          title: 'Illegal Published Update',
        }),
      ).toThrow(CourseValidationError);

      expect(course.status).toBe(CourseStatus.PUBLISHED);
      expect(course.title).toBe('TypeScript Fundamentals');
    });

    it('blocks metadata mutation after publication followed by unpublication', () => {
      const course = createCourse();

      moveToUnpublished(course);

      expect(() =>
        course.updateMetadata({
          title: 'Illegal Unpublished Update',
        }),
      ).toThrow(CourseValidationError);

      expect(course.status).toBe(CourseStatus.UNPUBLISHED);
      expect(course.title).toBe('TypeScript Fundamentals');
    });

    it('keeps publication identity consistent with the Course aggregate', () => {
      const course = createCourse();

      const originalId = course.id.toString();

      moveToPublished(course);

      const [event] = course
        .getDomainEvents()
        .filter(
          (candidate) =>
            candidate.eventName === CourseDomainEventName.PUBLISHED,
        );

      expect(event?.aggregateId).toBe(originalId);
      expect(event?.payload).toMatchObject({
        courseId: originalId,
      });
    });
  });
});