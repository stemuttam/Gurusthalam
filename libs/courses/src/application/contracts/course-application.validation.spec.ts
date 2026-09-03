import { describe, expect, it } from 'vitest';

import {
  courseIdInputSchema,
  courseExistsInputSchema,
  createCourseInputSchema,
  getCourseInputSchema,
} from './course-application.validation.js';

import { CourseLevel } from '../../domain/enums/course-level.js';
import { CourseType } from '../../domain/enums/course-type.js';
import { CourseVisibility } from '../../domain/enums/course-visibility.js';

describe('Course application validation contracts', () => {
  describe('createCourseInputSchema', () => {
    it('accepts the minimum valid create input', () => {
      const result = createCourseInputSchema.parse({
        title: 'Introduction to Physics',
        level: CourseLevel.BEGINNER,
        type: CourseType.SELF_PACED,
        instructorId: 'instructor-123',
      });

      expect(result).toEqual({
        title: 'Introduction to Physics',
        level: CourseLevel.BEGINNER,
        type: CourseType.SELF_PACED,
        instructorId: 'instructor-123',
      });
    });

    it('accepts a nullable description', () => {
      const result = createCourseInputSchema.parse({
        title: 'Introduction to Physics',
        description: null,
        level: CourseLevel.BEGINNER,
        type: CourseType.SELF_PACED,
        instructorId: 'instructor-123',
      });

      expect(result.description).toBeNull();
    });

    it('accepts a valid description', () => {
      const result = createCourseInputSchema.parse({
        title: 'Introduction to Physics',
        description: 'Learn the fundamentals of physics.',
        level: CourseLevel.BEGINNER,
        type: CourseType.SELF_PACED,
        instructorId: 'instructor-123',
      });

      expect(result.description).toBe(
        'Learn the fundamentals of physics.',
      );
    });

    it('accepts an explicitly supplied visibility', () => {
      const result = createCourseInputSchema.parse({
        title: 'Introduction to Physics',
        level: CourseLevel.BEGINNER,
        type: CourseType.SELF_PACED,
        visibility: CourseVisibility.PUBLIC,
        instructorId: 'instructor-123',
      });

      expect(result.visibility).toBe(CourseVisibility.PUBLIC);
    });

    it('trims title whitespace', () => {
      const result = createCourseInputSchema.parse({
        title: '  Introduction to Physics  ',
        level: CourseLevel.BEGINNER,
        type: CourseType.SELF_PACED,
        instructorId: 'instructor-123',
      });

      expect(result.title).toBe('Introduction to Physics');
    });

    it('trims description whitespace', () => {
      const result = createCourseInputSchema.parse({
        title: 'Introduction to Physics',
        description: '  Learn physics.  ',
        level: CourseLevel.BEGINNER,
        type: CourseType.SELF_PACED,
        instructorId: 'instructor-123',
      });

      expect(result.description).toBe('Learn physics.');
    });

    it('trims instructor id whitespace', () => {
      const result = createCourseInputSchema.parse({
        title: 'Introduction to Physics',
        level: CourseLevel.BEGINNER,
        type: CourseType.SELF_PACED,
        instructorId: '  instructor-123  ',
      });

      expect(result.instructorId).toBe('instructor-123');
    });

    it('rejects an empty title', () => {
      expect(() =>
        createCourseInputSchema.parse({
          title: '',
          level: CourseLevel.BEGINNER,
          type: CourseType.SELF_PACED,
          instructorId: 'instructor-123',
        }),
      ).toThrow();
    });

    it('rejects a whitespace-only title', () => {
      expect(() =>
        createCourseInputSchema.parse({
          title: '   ',
          level: CourseLevel.BEGINNER,
          type: CourseType.SELF_PACED,
          instructorId: 'instructor-123',
        }),
      ).toThrow();
    });

    it('rejects a title longer than 200 characters', () => {
      expect(() =>
        createCourseInputSchema.parse({
          title: 'a'.repeat(201),
          level: CourseLevel.BEGINNER,
          type: CourseType.SELF_PACED,
          instructorId: 'instructor-123',
        }),
      ).toThrow();
    });

    it('accepts a title with exactly 200 characters', () => {
      const result = createCourseInputSchema.parse({
        title: 'a'.repeat(200),
        level: CourseLevel.BEGINNER,
        type: CourseType.SELF_PACED,
        instructorId: 'instructor-123',
      });

      expect(result.title).toHaveLength(200);
    });

    it('rejects an empty description', () => {
      expect(() =>
        createCourseInputSchema.parse({
          title: 'Introduction to Physics',
          description: '',
          level: CourseLevel.BEGINNER,
          type: CourseType.SELF_PACED,
          instructorId: 'instructor-123',
        }),
      ).toThrow();
    });

    it('rejects a whitespace-only description', () => {
      expect(() =>
        createCourseInputSchema.parse({
          title: 'Introduction to Physics',
          description: '   ',
          level: CourseLevel.BEGINNER,
          type: CourseType.SELF_PACED,
          instructorId: 'instructor-123',
        }),
      ).toThrow();
    });

    it('rejects a description longer than 10000 characters', () => {
      expect(() =>
        createCourseInputSchema.parse({
          title: 'Introduction to Physics',
          description: 'a'.repeat(10_001),
          level: CourseLevel.BEGINNER,
          type: CourseType.SELF_PACED,
          instructorId: 'instructor-123',
        }),
      ).toThrow();
    });

    it('accepts a description with exactly 10000 characters', () => {
      const result = createCourseInputSchema.parse({
        title: 'Introduction to Physics',
        description: 'a'.repeat(10_000),
        level: CourseLevel.BEGINNER,
        type: CourseType.SELF_PACED,
        instructorId: 'instructor-123',
      });

      expect(result.description).toHaveLength(10_000);
    });

    it('rejects an empty instructor id', () => {
      expect(() =>
        createCourseInputSchema.parse({
          title: 'Introduction to Physics',
          level: CourseLevel.BEGINNER,
          type: CourseType.SELF_PACED,
          instructorId: '',
        }),
      ).toThrow();
    });

    it('rejects a whitespace-only instructor id', () => {
      expect(() =>
        createCourseInputSchema.parse({
          title: 'Introduction to Physics',
          level: CourseLevel.BEGINNER,
          type: CourseType.SELF_PACED,
          instructorId: '   ',
        }),
      ).toThrow();
    });

    it('rejects an invalid course level', () => {
      expect(() =>
        createCourseInputSchema.parse({
          title: 'Introduction to Physics',
          level: 'INVALID',
          type: CourseType.SELF_PACED,
          instructorId: 'instructor-123',
        }),
      ).toThrow();
    });

    it('rejects an invalid course type', () => {
      expect(() =>
        createCourseInputSchema.parse({
          title: 'Introduction to Physics',
          level: CourseLevel.BEGINNER,
          type: 'INVALID',
          instructorId: 'instructor-123',
        }),
      ).toThrow();
    });

    it('rejects an invalid visibility', () => {
      expect(() =>
        createCourseInputSchema.parse({
          title: 'Introduction to Physics',
          level: CourseLevel.BEGINNER,
          type: CourseType.SELF_PACED,
          visibility: 'INVALID',
          instructorId: 'instructor-123',
        }),
      ).toThrow();
    });

    it('rejects unexpected fields', () => {
      expect(() =>
        createCourseInputSchema.parse({
          title: 'Introduction to Physics',
          level: CourseLevel.BEGINNER,
          type: CourseType.SELF_PACED,
          instructorId: 'instructor-123',
          status: 'PUBLISHED',
        }),
      ).toThrow();
    });
  });

  describe('getCourseInputSchema', () => {
    it('accepts a valid course id', () => {
      const result = getCourseInputSchema.parse({
        courseId: 'course-123',
      });

      expect(result.courseId).toBe('course-123');
    });

    it('trims the course id', () => {
      const result = getCourseInputSchema.parse({
        courseId: '  course-123  ',
      });

      expect(result.courseId).toBe('course-123');
    });

    it('rejects an empty course id', () => {
      expect(() =>
        getCourseInputSchema.parse({
          courseId: '',
        }),
      ).toThrow();
    });

    it('rejects a whitespace-only course id', () => {
      expect(() =>
        getCourseInputSchema.parse({
          courseId: '   ',
        }),
      ).toThrow();
    });

    it('rejects unexpected fields', () => {
      expect(() =>
        getCourseInputSchema.parse({
          courseId: 'course-123',
          extra: true,
        }),
      ).toThrow();
    });
  });

  describe('courseExistsInputSchema', () => {
    it('accepts a valid course id', () => {
      const result = courseExistsInputSchema.parse({
        courseId: 'course-123',
      });

      expect(result.courseId).toBe('course-123');
    });

    it('trims the course id', () => {
      const result = courseExistsInputSchema.parse({
        courseId: '  course-123  ',
      });

      expect(result.courseId).toBe('course-123');
    });

    it('rejects an empty course id', () => {
      expect(() =>
        courseExistsInputSchema.parse({
          courseId: '',
        }),
      ).toThrow();
    });

    it('rejects a whitespace-only course id', () => {
      expect(() =>
        courseExistsInputSchema.parse({
          courseId: '   ',
        }),
      ).toThrow();
    });

    it('rejects unexpected fields', () => {
      expect(() =>
        courseExistsInputSchema.parse({
          courseId: 'course-123',
          extra: true,
        }),
      ).toThrow();
    });
  });

  describe('courseIdInputSchema', () => {
    it('accepts a valid course id', () => {
      expect(courseIdInputSchema.parse('course-123')).toBe(
        'course-123',
      );
    });

    it('trims a valid course id', () => {
      expect(courseIdInputSchema.parse('  course-123  ')).toBe(
        'course-123',
      );
    });

    it('rejects an empty course id', () => {
      expect(() => courseIdInputSchema.parse('')).toThrow();
    });

    it('rejects a whitespace-only course id', () => {
      expect(() => courseIdInputSchema.parse('   ')).toThrow();
    });
  });
});