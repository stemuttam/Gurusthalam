import { describe, expect, it } from 'vitest';

import { createCourseVersionInputSchema } from '../../index.js';

import type { CreateCourseVersionInput } from '../../index.js';

describe('CourseVersion application public contract — 4.10-C', () => {
  it('exports the CreateVersion runtime schema from the public Course barrel', () => {
    expect(
      createCourseVersionInputSchema.parse({
        courseId: 'course-001',
      }),
    ).toEqual({
      courseId: 'course-001',
    });
  });

  it('keeps CreateVersion independent from authorization concerns', () => {
    expect(() =>
      createCourseVersionInputSchema.parse({
        courseId: 'course-001',
        actorId: 'actor-001',
      }),
    ).toThrow();

    expect(() =>
      createCourseVersionInputSchema.parse({
        courseId: 'course-001',
        role: 'EDITOR',
      }),
    ).toThrow();
  });

  it('does not allow the caller to control version state', () => {
    expect(() =>
      createCourseVersionInputSchema.parse({
        courseId: 'course-001',
        version: 4,
      }),
    ).toThrow();

    expect(() =>
      createCourseVersionInputSchema.parse({
        courseId: 'course-001',
        status: 'PUBLISHED',
      }),
    ).toThrow();
  });

  it('exposes the CreateVersion input type through the public Course barrel', () => {
    const input: CreateCourseVersionInput = {
      courseId: 'course-001',
    };

    expect(input.courseId).toBe('course-001');
  });
});
