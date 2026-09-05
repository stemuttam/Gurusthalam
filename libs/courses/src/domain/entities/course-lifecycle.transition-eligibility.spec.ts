import { describe, expect, it } from 'vitest';

import { Course } from './course.js';

import { CourseLevel } from '../enums/course-level.js';
import { CourseStatus } from '../enums/course-status.js';
import { CourseType } from '../enums/course-type.js';
import { CourseVisibility } from '../enums/course-visibility.js';

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

describe('Course lifecycle transition eligibility', () => {
  describe('DRAFT transition eligibility', () => {
    it('allows DRAFT → IN_REVIEW', () => {
      const course = createCourse();

      course.submitForReview();

      expect(course.status).toBe(CourseStatus.IN_REVIEW);
    });

    it('rejects DRAFT → PUBLISHED', () => {
      const course = createCourse();

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.DRAFT);
    });

    it('rejects DRAFT → UNPUBLISHED', () => {
      const course = createCourse();

      expect(() => course.unpublish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.DRAFT);
    });

    it('rejects DRAFT → ARCHIVED', () => {
      const course = createCourse();

      expect(() => course.archive()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.DRAFT);
    });

    it('rejects repeated DRAFT → DRAFT submission', () => {
      const course = createCourse();

      course.submitForReview();

      expect(() => course.submitForReview()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.IN_REVIEW);
    });
  });

  describe('IN_REVIEW transition eligibility', () => {
    it('allows IN_REVIEW → PUBLISHED', () => {
      const course = createCourse();

      moveToReview(course);
      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
    });

    it('rejects IN_REVIEW → UNPUBLISHED', () => {
      const course = createCourse();

      moveToReview(course);

      expect(() => course.unpublish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.IN_REVIEW);
    });

    it('rejects IN_REVIEW → ARCHIVED', () => {
      const course = createCourse();

      moveToReview(course);

      expect(() => course.archive()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.IN_REVIEW);
    });

    it('rejects repeated IN_REVIEW → IN_REVIEW submission', () => {
      const course = createCourse();

      moveToReview(course);

      expect(() => course.submitForReview()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.IN_REVIEW);
    });
  });

  describe('PUBLISHED transition eligibility', () => {
    it('allows PUBLISHED → UNPUBLISHED', () => {
      const course = createCourse();

      moveToPublished(course);
      course.unpublish();

      expect(course.status).toBe(CourseStatus.UNPUBLISHED);
    });

    it('allows PUBLISHED → ARCHIVED', () => {
      const course = createCourse();

      moveToPublished(course);
      course.archive();

      expect(course.status).toBe(CourseStatus.ARCHIVED);
    });

    it('rejects PUBLISHED → IN_REVIEW', () => {
      const course = createCourse();

      moveToPublished(course);

      expect(() => course.submitForReview()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.PUBLISHED);
    });

    it('rejects repeated PUBLISHED → PUBLISHED publication', () => {
      const course = createCourse();

      moveToPublished(course);

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.PUBLISHED);
    });
  });

  describe('UNPUBLISHED transition eligibility', () => {
    it('allows UNPUBLISHED → ARCHIVED', () => {
      const course = createCourse();

      moveToUnpublished(course);
      course.archive();

      expect(course.status).toBe(CourseStatus.ARCHIVED);
    });

    it('rejects UNPUBLISHED → PUBLISHED', () => {
      const course = createCourse();

      moveToUnpublished(course);

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.UNPUBLISHED);
    });

    it('rejects UNPUBLISHED → IN_REVIEW', () => {
      const course = createCourse();

      moveToUnpublished(course);

      expect(() => course.submitForReview()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.UNPUBLISHED);
    });

    it('rejects repeated UNPUBLISHED → UNPUBLISHED transition', () => {
      const course = createCourse();

      moveToUnpublished(course);

      expect(() => course.unpublish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.UNPUBLISHED);
    });
  });

  describe('ARCHIVED transition eligibility', () => {
    it('rejects ARCHIVED → IN_REVIEW', () => {
      const course = createCourse();

      moveToArchived(course);

      expect(() => course.submitForReview()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.ARCHIVED);
    });

    it('rejects ARCHIVED → PUBLISHED', () => {
      const course = createCourse();

      moveToArchived(course);

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.ARCHIVED);
    });

    it('rejects ARCHIVED → UNPUBLISHED', () => {
      const course = createCourse();

      moveToArchived(course);

      expect(() => course.unpublish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.ARCHIVED);
    });

    it('rejects ARCHIVED → ARCHIVED', () => {
      const course = createCourse();

      moveToArchived(course);

      expect(() => course.archive()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.ARCHIVED);
    });
  });

  describe('rejected transition atomicity', () => {
    it('preserves status after a rejected transition', () => {
      const course = createCourse();

      const previousStatus = course.status;

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(previousStatus);
    });

    it('preserves updatedAt after a rejected transition', () => {
      const course = createCourse();

      const previousUpdatedAt = course.updatedAt.getTime();

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.updatedAt.getTime()).toBe(previousUpdatedAt);
    });

    it('does not append an event after a rejected transition', () => {
      const course = createCourse();

      course.pullDomainEvents();

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('preserves aggregate identity after a rejected transition', () => {
      const course = createCourse();

      const originalId = course.id;

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.id).toBe(originalId);
    });

    it('preserves instructor ownership after a rejected transition', () => {
      const course = createCourse();

      const originalInstructorId = course.instructorId;

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.instructorId).toBe(originalInstructorId);
    });

    it('preserves metadata after a rejected transition', () => {
      const course = createCourse();

      const original = {
        title: course.title,
        description: course.description,
        level: course.level,
        type: course.type,
        visibility: course.visibility,
      };

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.title).toBe(original.title);
      expect(course.description).toBe(original.description);
      expect(course.level).toBe(original.level);
      expect(course.type).toBe(original.type);
      expect(course.visibility).toBe(original.visibility);
    });
  });

  describe('terminal ARCHIVED boundary', () => {
    it('keeps ARCHIVED immutable across every lifecycle command', () => {
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

    it('preserves updatedAt throughout rejected ARCHIVED operations', () => {
      const course = createCourse();

      moveToArchived(course);

      const archivedUpdatedAt = course.updatedAt.getTime();

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

      expect(course.updatedAt.getTime()).toBe(archivedUpdatedAt);
    });

    it('preserves aggregate identity throughout rejected ARCHIVED operations', () => {
      const course = createCourse();

      moveToArchived(course);

      const archivedId = course.id;

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

      expect(course.id).toBe(archivedId);
    });
  });
});