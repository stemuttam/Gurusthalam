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

describe('Course timestamp invariants', () => {
  describe('creation timestamps', () => {
    it('creates a valid createdAt timestamp', () => {
      const course = createCourse();

      expect(course.createdAt).toBeInstanceOf(Date);
      expect(course.createdAt.getTime()).not.toBeNaN();
    });

    it('creates a valid updatedAt timestamp', () => {
      const course = createCourse();

      expect(course.updatedAt).toBeInstanceOf(Date);
      expect(course.updatedAt.getTime()).not.toBeNaN();
    });

    it('starts with createdAt and updatedAt representing the same instant', () => {
      const course = createCourse();

      expect(course.createdAt.getTime()).toBe(course.updatedAt.getTime());
    });

    it('establishes createdAt no later than updatedAt', () => {
      const course = createCourse();

      expect(course.createdAt.getTime()).toBeLessThanOrEqual(
        course.updatedAt.getTime(),
      );
    });
  });

  describe('createdAt immutability', () => {
    it('preserves createdAt after metadata mutation', () => {
      const course = createCourse();
      const originalCreatedAt = course.createdAt.getTime();

      course.updateMetadata({
        title: 'Updated Course',
      });

      expect(course.createdAt.getTime()).toBe(originalCreatedAt);
    });

    it('preserves createdAt through the complete lifecycle', () => {
      const course = createCourse();
      const originalCreatedAt = course.createdAt.getTime();

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      expect(course.createdAt.getTime()).toBe(originalCreatedAt);
    });
  });

  describe('updatedAt successful mutation behavior', () => {
    it('keeps updatedAt valid after metadata mutation', () => {
      const course = createCourse();
      const previousUpdatedAt = course.updatedAt.getTime();

      course.updateMetadata({
        title: 'Updated Course',
      });

      expect(course.updatedAt.getTime()).not.toBeNaN();
      expect(course.updatedAt.getTime()).toBeGreaterThanOrEqual(
        previousUpdatedAt,
      );
    });

    it('keeps createdAt no later than updatedAt after metadata mutation', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Updated Course',
      });

      expect(course.createdAt.getTime()).toBeLessThanOrEqual(
        course.updatedAt.getTime(),
      );
    });

    it('updates updatedAt after submitting for review', () => {
      const course = createCourse();
      const previousUpdatedAt = course.updatedAt.getTime();

      course.submitForReview();

      expect(course.updatedAt.getTime()).toBeGreaterThanOrEqual(
        previousUpdatedAt,
      );
    });

    it('updates updatedAt after publishing', () => {
      const course = createCourse();

      course.submitForReview();

      const previousUpdatedAt = course.updatedAt.getTime();

      course.publish();

      expect(course.updatedAt.getTime()).toBeGreaterThanOrEqual(
        previousUpdatedAt,
      );
    });

    it('updates updatedAt after unpublishing', () => {
      const course = createCourse();

      moveToPublished(course);

      const previousUpdatedAt = course.updatedAt.getTime();

      course.unpublish();

      expect(course.updatedAt.getTime()).toBeGreaterThanOrEqual(
        previousUpdatedAt,
      );
    });

    it('updates updatedAt after archiving a published Course', () => {
      const course = createCourse();

      moveToPublished(course);

      const previousUpdatedAt = course.updatedAt.getTime();

      course.archive();

      expect(course.updatedAt.getTime()).toBeGreaterThanOrEqual(
        previousUpdatedAt,
      );
    });

    it('updates updatedAt after archiving an unpublished Course', () => {
      const course = createCourse();

      moveToUnpublished(course);

      const previousUpdatedAt = course.updatedAt.getTime();

      course.archive();

      expect(course.updatedAt.getTime()).toBeGreaterThanOrEqual(
        previousUpdatedAt,
      );
    });
  });

  describe('updatedAt failed mutation behavior', () => {
    it('does not change updatedAt when publication is rejected', () => {
      const course = createCourse();
      const originalUpdatedAt = course.updatedAt.getTime();

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.updatedAt.getTime()).toBe(originalUpdatedAt);
    });

    it('does not change updatedAt when unpublication is rejected', () => {
      const course = createCourse();
      const originalUpdatedAt = course.updatedAt.getTime();

      expect(() => course.unpublish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.updatedAt.getTime()).toBe(originalUpdatedAt);
    });

    it('does not change updatedAt when archiving is rejected', () => {
      const course = createCourse();
      const originalUpdatedAt = course.updatedAt.getTime();

      expect(() => course.archive()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.updatedAt.getTime()).toBe(originalUpdatedAt);
    });

    it('does not change updatedAt when metadata validation fails', () => {
      const course = createCourse();
      const originalUpdatedAt = course.updatedAt.getTime();

      expect(() =>
        course.updateMetadata({
          title: '',
        }),
      ).toThrow(CourseValidationError);

      expect(course.updatedAt.getTime()).toBe(originalUpdatedAt);
    });

    it('does not change updatedAt when metadata mutation is blocked by state', () => {
      const course = createCourse();

      course.submitForReview();

      const originalUpdatedAt = course.updatedAt.getTime();

      expect(() =>
        course.updateMetadata({
          title: 'Illegal Update',
        }),
      ).toThrow(CourseValidationError);

      expect(course.updatedAt.getTime()).toBe(originalUpdatedAt);
    });
  });

  describe('timestamp defensive-copy invariants', () => {
    it('returns a detached createdAt Date instance', () => {
      const course = createCourse();

      const createdAt = course.createdAt;
      const originalValue = createdAt.getTime();

      createdAt.setTime(0);

      expect(course.createdAt.getTime()).toBe(originalValue);
      expect(course.createdAt).not.toBe(createdAt);
    });

    it('returns a detached updatedAt Date instance', () => {
      const course = createCourse();

      const updatedAt = course.updatedAt;
      const originalValue = updatedAt.getTime();

      updatedAt.setTime(0);

      expect(course.updatedAt.getTime()).toBe(originalValue);
      expect(course.updatedAt).not.toBe(updatedAt);
    });

    it('does not allow createdAt getter mutation to affect serialization', () => {
      const course = createCourse();
      const originalValue = course.createdAt.getTime();

      const createdAt = course.createdAt;
      createdAt.setTime(0);

      expect(course.toPrimitives().createdAt.getTime()).toBe(originalValue);
    });

    it('does not allow updatedAt getter mutation to affect serialization', () => {
      const course = createCourse();
      const originalValue = course.updatedAt.getTime();

      const updatedAt = course.updatedAt;
      updatedAt.setTime(0);

      expect(course.toPrimitives().updatedAt.getTime()).toBe(originalValue);
    });

    it('returns detached timestamp instances from toPrimitives', () => {
      const course = createCourse();

      const primitives = course.toPrimitives();

      expect(primitives.createdAt).not.toBe(course.createdAt);
      expect(primitives.updatedAt).not.toBe(course.updatedAt);
    });

    it('does not allow primitive timestamp mutation to affect the aggregate', () => {
      const course = createCourse();

      const originalCreatedAt = course.createdAt.getTime();
      const originalUpdatedAt = course.updatedAt.getTime();

      const primitives = course.toPrimitives();

      primitives.createdAt.setTime(0);
      primitives.updatedAt.setTime(0);

      expect(course.createdAt.getTime()).toBe(originalCreatedAt);
      expect(course.updatedAt.getTime()).toBe(originalUpdatedAt);
    });
  });

  describe('timestamp serialization invariants', () => {
    it('preserves timestamps during serialization', () => {
      const course = createCourse();

      const primitives = course.toPrimitives();

      expect(primitives.createdAt.getTime()).toBe(
        course.createdAt.getTime(),
      );
      expect(primitives.updatedAt.getTime()).toBe(
        course.updatedAt.getTime(),
      );
    });

    it('preserves timestamps during rehydration', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Updated Course',
      });

      const primitives = course.toPrimitives();
      const rehydrated = Course.rehydrate(primitives);

      expect(rehydrated.createdAt.getTime()).toBe(
        course.createdAt.getTime(),
      );
      expect(rehydrated.updatedAt.getTime()).toBe(
        course.updatedAt.getTime(),
      );
    });

    it('does not generate a new timestamp pair during rehydration', () => {
      const course = createCourse();

      const primitives = course.toPrimitives();
      const rehydrated = Course.rehydrate(primitives);

      expect(rehydrated.createdAt.getTime()).toBe(
        primitives.createdAt.getTime(),
      );
      expect(rehydrated.updatedAt.getTime()).toBe(
        primitives.updatedAt.getTime(),
      );
    });
  });

  describe('timestamp ordering invariants', () => {
    it('keeps createdAt less than or equal to updatedAt after each valid mutation', () => {
      const course = createCourse();

      expect(course.createdAt.getTime()).toBeLessThanOrEqual(
        course.updatedAt.getTime(),
      );

      course.updateMetadata({
        title: 'Updated Course',
      });

      expect(course.createdAt.getTime()).toBeLessThanOrEqual(
        course.updatedAt.getTime(),
      );

      course.submitForReview();

      expect(course.createdAt.getTime()).toBeLessThanOrEqual(
        course.updatedAt.getTime(),
      );

      course.publish();

      expect(course.createdAt.getTime()).toBeLessThanOrEqual(
        course.updatedAt.getTime(),
      );

      course.unpublish();

      expect(course.createdAt.getTime()).toBeLessThanOrEqual(
        course.updatedAt.getTime(),
      );

      course.archive();

      expect(course.createdAt.getTime()).toBeLessThanOrEqual(
        course.updatedAt.getTime(),
      );
    });

    it('keeps timestamps valid after the aggregate reaches ARCHIVED', () => {
      const course = createCourse();

      moveToArchived(course);

      expect(course.createdAt).toBeInstanceOf(Date);
      expect(course.updatedAt).toBeInstanceOf(Date);
      expect(course.createdAt.getTime()).not.toBeNaN();
      expect(course.updatedAt.getTime()).not.toBeNaN();
      expect(course.createdAt.getTime()).toBeLessThanOrEqual(
        course.updatedAt.getTime(),
      );
    });
  });
});