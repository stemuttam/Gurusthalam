import { describe, expect, it } from 'vitest';

import {
  CourseLevel,
} from '../enums/course-level.js';
import {
  CourseStatus,
} from '../enums/course-status.js';
import {
  CourseType,
} from '../enums/course-type.js';
import {
  CourseVisibility,
} from '../enums/course-visibility.js';
import {
  CourseValidationError,
  InvalidCourseStateTransitionError,
} from '../errors/index.js';
import { Course } from './course.js';

const createCourse = () =>
  Course.create({
    title: 'TypeScript Fundamentals',
    description: 'Learn TypeScript from the ground up.',
    level: CourseLevel.BEGINNER,
    type: CourseType.SELF_PACED,
    visibility: CourseVisibility.PRIVATE,
    instructorId: 'instructor-123',
  });

describe('Course aggregate', () => {
  describe('create', () => {
    it('creates a Course in DRAFT status', () => {
      const course = createCourse();

      expect(course.id.value).toBeTypeOf('string');
      expect(course.title).toBe('TypeScript Fundamentals');
      expect(course.description).toBe(
        'Learn TypeScript from the ground up.',
      );
      expect(course.level).toBe(CourseLevel.BEGINNER);
      expect(course.type).toBe(CourseType.SELF_PACED);
      expect(course.visibility).toBe(CourseVisibility.PRIVATE);
      expect(course.status).toBe(CourseStatus.DRAFT);
      expect(course.instructorId).toBe('instructor-123');
    });

    it('defaults visibility to PRIVATE', () => {
      const course = Course.create({
        title: 'Test Course',
        level: CourseLevel.BEGINNER,
        type: CourseType.SELF_PACED,
        instructorId: 'instructor-123',
      });

      expect(course.visibility).toBe(CourseVisibility.PRIVATE);
    });

    it('creates distinct Course identifiers', () => {
      const first = createCourse();
      const second = createCourse();

      expect(first.id.equals(second.id)).toBe(false);
    });

    it('rejects an empty title', () => {
      expect(() =>
        Course.create({
          title: '   ',
          level: CourseLevel.BEGINNER,
          type: CourseType.SELF_PACED,
          instructorId: 'instructor-123',
        }),
      ).toThrow(CourseValidationError);
    });

    it('rejects an empty instructor identifier', () => {
      expect(() =>
        Course.create({
          title: 'Valid Course',
          level: CourseLevel.BEGINNER,
          type: CourseType.SELF_PACED,
          instructorId: '   ',
        }),
      ).toThrow(CourseValidationError);
    });

    it('rejects an empty description', () => {
      expect(() =>
        Course.create({
          title: 'Valid Course',
          description: '   ',
          level: CourseLevel.BEGINNER,
          type: CourseType.SELF_PACED,
          instructorId: 'instructor-123',
        }),
      ).toThrow(CourseValidationError);
    });
  });

  describe('metadata updates', () => {
    it('updates metadata while the Course is in DRAFT', () => {
      const course = createCourse();
      const previousUpdatedAt = course.updatedAt;

      course.updateMetadata({
        title: 'Advanced TypeScript Fundamentals',
        description: 'Updated description.',
        level: CourseLevel.INTERMEDIATE,
        type: CourseType.BLENDED,
        visibility: CourseVisibility.PUBLIC,
      });

      expect(course.title).toBe('Advanced TypeScript Fundamentals');
      expect(course.description).toBe('Updated description.');
      expect(course.level).toBe(CourseLevel.INTERMEDIATE);
      expect(course.type).toBe(CourseType.BLENDED);
      expect(course.visibility).toBe(CourseVisibility.PUBLIC);
      expect(course.updatedAt.getTime()).toBeGreaterThanOrEqual(
        previousUpdatedAt.getTime(),
      );
    });

    it('allows updating only a subset of metadata', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'New Title',
      });

      expect(course.title).toBe('New Title');
      expect(course.description).toBe(
        'Learn TypeScript from the ground up.',
      );
      expect(course.level).toBe(CourseLevel.BEGINNER);
      expect(course.type).toBe(CourseType.SELF_PACED);
    });

    it('rejects metadata updates after submission for review', () => {
      const course = createCourse();

      course.submitForReview();

      expect(() =>
        course.updateMetadata({
          title: 'Should Not Change',
        }),
      ).toThrow(CourseValidationError);
    });
  });

  describe('lifecycle', () => {
    it('transitions DRAFT to IN_REVIEW', () => {
      const course = createCourse();

      course.submitForReview();

      expect(course.status).toBe(CourseStatus.IN_REVIEW);
    });

    it('transitions IN_REVIEW to PUBLISHED', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
    });

    it('transitions PUBLISHED to UNPUBLISHED', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();
      course.unpublish();

      expect(course.status).toBe(CourseStatus.UNPUBLISHED);
    });

    it('transitions PUBLISHED to ARCHIVED', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();
      course.archive();

      expect(course.status).toBe(CourseStatus.ARCHIVED);
    });

    it('transitions UNPUBLISHED to ARCHIVED', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      expect(course.status).toBe(CourseStatus.ARCHIVED);
    });

    it('rejects submitting an archived Course for review', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();
      course.archive();

      expect(() => course.submitForReview()).toThrow(
        InvalidCourseStateTransitionError,
      );
    });

    it('rejects publishing a DRAFT Course', () => {
      const course = createCourse();

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );
    });

    it('rejects unpublishing a DRAFT Course', () => {
      const course = createCourse();

      expect(() => course.unpublish()).toThrow(
        InvalidCourseStateTransitionError,
      );
    });

    it('rejects archiving a DRAFT Course', () => {
      const course = createCourse();

      expect(() => course.archive()).toThrow(
        InvalidCourseStateTransitionError,
      );
    });

    it('rejects re-archiving an archived Course', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();
      course.archive();

      expect(() => course.archive()).toThrow(
        InvalidCourseStateTransitionError,
      );
    });
  });

  describe('serialization', () => {
    it('returns a detached primitive representation', () => {
      const course = createCourse();
      const primitives = course.toPrimitives();

      expect(primitives.id).toBe(course.id);
      expect(primitives.title).toBe(course.title);
      expect(primitives.status).toBe(course.status);

      expect(primitives.createdAt).not.toBe(course.createdAt);
      expect(primitives.updatedAt).not.toBe(course.updatedAt);
    });
  });

  describe('rehydration', () => {
    it('rehydrates a Course without generating a new identity', () => {
      const course = createCourse();

      const rehydrated = Course.rehydrate(course.toPrimitives());

      expect(rehydrated.id.equals(course.id)).toBe(true);
      expect(rehydrated.title).toBe(course.title);
      expect(rehydrated.status).toBe(course.status);
    });
  });
});