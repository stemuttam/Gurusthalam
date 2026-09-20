import { describe, expect, it } from 'vitest';

import { createCourseVersionInputSchema } from './course-version-application.validation.js';

describe('CourseVersion application validation contracts', () => {
  it('accepts a valid course identifier', () => {
    const result = createCourseVersionInputSchema.parse({
      courseId: 'course-123',
    });

    expect(result).toEqual({
      courseId: 'course-123',
    });
  });

  it('trims the course identifier', () => {
    const result = createCourseVersionInputSchema.parse({
      courseId: '  course-123  ',
    });

    expect(result.courseId).toBe('course-123');
  });

  it('rejects an empty course identifier', () => {
    expect(() =>
      createCourseVersionInputSchema.parse({
        courseId: '',
      }),
    ).toThrow();
  });

  it('rejects a whitespace-only course identifier', () => {
    expect(() =>
      createCourseVersionInputSchema.parse({
        courseId: '   ',
      }),
    ).toThrow();
  });

  it('rejects unexpected fields', () => {
    expect(() =>
      createCourseVersionInputSchema.parse({
        courseId: 'course-123',
        version: 2,
      }),
    ).toThrow();
  });

  it('does not accept a caller-selected status', () => {
    expect(() =>
      createCourseVersionInputSchema.parse({
        courseId: 'course-123',
        status: 'PUBLISHED',
      }),
    ).toThrow();
  });

  it('does not accept a caller-selected version number', () => {
    expect(() =>
      createCourseVersionInputSchema.parse({
        courseId: 'course-123',
        version: 7,
      }),
    ).toThrow();
  });

  it('does not accept a caller-selected metadata snapshot', () => {
    expect(() =>
      createCourseVersionInputSchema.parse({
        courseId: 'course-123',
        title: 'Caller supplied title',
      }),
    ).toThrow();
  });
});
