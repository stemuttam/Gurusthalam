import { describe, expect, it } from 'vitest';

import { Course } from './course.js';

import { CourseLevel } from '../enums/course-level.js';
import { CourseStatus } from '../enums/course-status.js';
import { CourseType } from '../enums/course-type.js';
import { CourseVisibility } from '../enums/course-visibility.js';

import { CourseValidationError } from '../errors/index.js';

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
  course.submitForReview();
  course.publish();
};

describe('Course metadata invariants', () => {
  describe('title invariants', () => {
    it('preserves a valid title during creation', () => {
      const course = createCourse();

      expect(course.title).toBe('TypeScript Fundamentals');
    });

    it('rejects a whitespace-only title during creation', () => {
      expect(() =>
        Course.create({
          title: '   ',
          level: CourseLevel.BEGINNER,
          type: CourseType.SELF_PACED,
          instructorId: 'instructor-123',
        }),
      ).toThrow(CourseValidationError);
    });

    it('rejects an empty title during metadata update', () => {
      const course = createCourse();

      expect(() =>
        course.updateMetadata({
          title: '',
        }),
      ).toThrow(CourseValidationError);

      expect(course.title).toBe('TypeScript Fundamentals');
    });

    it('rejects a whitespace-only title during metadata update', () => {
      const course = createCourse();

      expect(() =>
        course.updateMetadata({
          title: '     ',
        }),
      ).toThrow(CourseValidationError);

      expect(course.title).toBe('TypeScript Fundamentals');
    });

    it('rejects a title longer than 200 characters', () => {
      const course = createCourse();

      expect(() =>
        course.updateMetadata({
          title: 'a'.repeat(201),
        }),
      ).toThrow(CourseValidationError);

      expect(course.title).toBe('TypeScript Fundamentals');
    });

    it('accepts a title of exactly 200 characters', () => {
      const course = createCourse();
      const title = 'a'.repeat(200);

      course.updateMetadata({ title });

      expect(course.title).toBe(title);
      expect(course.title).toHaveLength(200);
    });
  });

  describe('description invariants', () => {
    it('allows a null description', () => {
      const course = Course.create({
        title: 'Course Without Description',
        description: null,
        level: CourseLevel.BEGINNER,
        type: CourseType.SELF_PACED,
        instructorId: 'instructor-123',
      });

      expect(course.description).toBeNull();
    });

    it('rejects a whitespace-only description during creation', () => {
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

    it('rejects an empty description during metadata update', () => {
      const course = createCourse();

      expect(() =>
        course.updateMetadata({
          description: '',
        }),
      ).toThrow(CourseValidationError);

      expect(course.description).toBe(
        'Learn TypeScript from the ground up.',
      );
    });

    it('rejects a whitespace-only description during metadata update', () => {
      const course = createCourse();

      expect(() =>
        course.updateMetadata({
          description: '     ',
        }),
      ).toThrow(CourseValidationError);

      expect(course.description).toBe(
        'Learn TypeScript from the ground up.',
      );
    });

    it('rejects a description longer than 10000 characters', () => {
      const course = createCourse();

      expect(() =>
        course.updateMetadata({
          description: 'a'.repeat(10_001),
        }),
      ).toThrow(CourseValidationError);

      expect(course.description).toBe(
        'Learn TypeScript from the ground up.',
      );
    });

    it('accepts a description of exactly 10000 characters', () => {
      const course = createCourse();
      const description = 'a'.repeat(10_000);

      course.updateMetadata({ description });

      expect(course.description).toBe(description);
      expect(course.description).toHaveLength(10_000);
    });

    it('allows clearing an existing description to null', () => {
      const course = createCourse();

      course.updateMetadata({
        description: null,
      });

      expect(course.description).toBeNull();
    });
  });

  describe('partial-update invariants', () => {
    it('preserves unspecified metadata fields', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Updated Title',
      });

      expect(course.title).toBe('Updated Title');
      expect(course.description).toBe(
        'Learn TypeScript from the ground up.',
      );
      expect(course.level).toBe(CourseLevel.BEGINNER);
      expect(course.type).toBe(CourseType.SELF_PACED);
      expect(course.visibility).toBe(CourseVisibility.PRIVATE);
    });

    it('updates all supplied metadata fields together', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Advanced TypeScript',
        description: 'A deeper TypeScript course.',
        level: CourseLevel.ADVANCED,
        type: CourseType.BLENDED,
        visibility: CourseVisibility.PUBLIC,
      });

      expect(course.title).toBe('Advanced TypeScript');
      expect(course.description).toBe('A deeper TypeScript course.');
      expect(course.level).toBe(CourseLevel.ADVANCED);
      expect(course.type).toBe(CourseType.BLENDED);
      expect(course.visibility).toBe(CourseVisibility.PUBLIC);
    });

    it('preserves metadata when an invalid update is rejected', () => {
      const course = createCourse();

      expect(() =>
        course.updateMetadata({
          title: '',
          level: CourseLevel.ADVANCED,
          type: CourseType.BLENDED,
          visibility: CourseVisibility.PUBLIC,
        }),
      ).toThrow(CourseValidationError);

      expect(course.title).toBe('TypeScript Fundamentals');
      expect(course.description).toBe(
        'Learn TypeScript from the ground up.',
      );
      expect(course.level).toBe(CourseLevel.BEGINNER);
      expect(course.type).toBe(CourseType.SELF_PACED);
      expect(course.visibility).toBe(CourseVisibility.PRIVATE);
    });
  });

  describe('state boundary invariants', () => {
    it('allows metadata changes only while in DRAFT', () => {
      const course = createCourse();

      expect(course.status).toBe(CourseStatus.DRAFT);

      course.updateMetadata({
        title: 'Draft Update',
      });

      expect(course.title).toBe('Draft Update');
    });

    it('rejects metadata changes after submission for review', () => {
      const course = createCourse();

      moveToReview(course);

      expect(course.status).toBe(CourseStatus.IN_REVIEW);

      expect(() =>
        course.updateMetadata({
          title: 'Should Not Change',
        }),
      ).toThrow(CourseValidationError);

      expect(course.title).toBe('TypeScript Fundamentals');
    });

    it('rejects metadata changes after publication', () => {
      const course = createCourse();

      moveToPublished(course);

      expect(course.status).toBe(CourseStatus.PUBLISHED);

      expect(() =>
        course.updateMetadata({
          title: 'Should Not Change',
        }),
      ).toThrow(CourseValidationError);

      expect(course.title).toBe('TypeScript Fundamentals');
    });

    it('rejects metadata changes after unpublishing', () => {
      const course = createCourse();

      moveToPublished(course);
      course.unpublish();

      expect(course.status).toBe(CourseStatus.UNPUBLISHED);

      expect(() =>
        course.updateMetadata({
          title: 'Should Not Change',
        }),
      ).toThrow(CourseValidationError);

      expect(course.title).toBe('TypeScript Fundamentals');
    });

    it('rejects metadata changes after archiving', () => {
      const course = createCourse();

      moveToPublished(course);
      course.archive();

      expect(course.status).toBe(CourseStatus.ARCHIVED);

      expect(() =>
        course.updateMetadata({
          title: 'Should Not Change',
        }),
      ).toThrow(CourseValidationError);

      expect(course.title).toBe('TypeScript Fundamentals');
    });
  });

  describe('mutation atomicity invariants', () => {
    it('does not change updatedAt when metadata validation fails', () => {
      const course = createCourse();
      const previousUpdatedAt = course.updatedAt.getTime();

      expect(() =>
        course.updateMetadata({
          title: '',
        }),
      ).toThrow(CourseValidationError);

      expect(course.updatedAt.getTime()).toBe(previousUpdatedAt);
    });

    it('does not create a metadata event when metadata validation fails', () => {
      const course = createCourse();

      course.pullDomainEvents();

      expect(() =>
        course.updateMetadata({
          title: '',
        }),
      ).toThrow(CourseValidationError);

      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('does not create a metadata event when the state boundary rejects mutation', () => {
      const course = createCourse();

      course.pullDomainEvents();
      course.submitForReview();
      course.pullDomainEvents();

      expect(() =>
        course.updateMetadata({
          title: 'Should Not Change',
        }),
      ).toThrow(CourseValidationError);

      expect(course.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('metadata event invariants', () => {
    it('creates exactly one metadata event for a successful update', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.updateMetadata({
        title: 'Updated Course',
      });

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]?.payload).toMatchObject({
        courseId: course.id.toString(),
        title: 'Updated Course',
      });
    });
  });
});