import { describe, expect, it } from 'vitest';

import { requestCourseChangesInputSchema } from '../../index.js';

import type {
  RequestCourseChangesInput,
  RequestCourseChangesInputSchema,
} from '../../index.js';

describe('Course request-changes application public contract', () => {
  it('exports the request-changes runtime schema from the public Course barrel', () => {
    expect(
      requestCourseChangesInputSchema.parse({
        courseId: 'course-001',
      }),
    ).toEqual({
      courseId: 'course-001',
    });
  });

  it('keeps the request-changes schema strict', () => {
    expect(() =>
      requestCourseChangesInputSchema.parse({
        courseId: 'course-001',
        actorId: 'actor-001',
      }),
    ).toThrow();

    expect(() =>
      requestCourseChangesInputSchema.parse({
        courseId: 'course-001',
        permission: 'COURSE_REQUEST_CHANGES',
      }),
    ).toThrow();

    expect(() =>
      requestCourseChangesInputSchema.parse({
        courseId: 'course-001',
        role: 'REVIEWER',
      }),
    ).toThrow();
  });

  it('exposes the request-changes input type through the public Course barrel', () => {
    const input: RequestCourseChangesInput = {
      courseId: 'course-001',
    };

    const schemaInput: RequestCourseChangesInputSchema = {
      courseId: 'course-001',
    };

    expect(input.courseId).toBe('course-001');

    expect(schemaInput.courseId).toBe('course-001');
  });

  it('rejects blank Course identifiers', () => {
    expect(() =>
      requestCourseChangesInputSchema.parse({
        courseId: '   ',
      }),
    ).toThrow();
  });
});
