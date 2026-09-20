import { describe, expect, it } from 'vitest';

import {
  createCourseVersionInputSchema,
  publishCourseVersionInputSchema,
} from '../../index.js';

import type {
  CreateCourseVersionInput,
  PublishCourseVersionInput,
} from '../../index.js';

describe('CourseVersion application public contract — 4.10-C / 4.10-D', () => {
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

  it('exports the PublishVersion runtime schema from the public Course barrel', () => {
    expect(
      publishCourseVersionInputSchema.parse({
        courseVersionId: 'course-version-001',
      }),
    ).toEqual({
      courseVersionId: 'course-version-001',
    });
  });

  it('keeps PublishVersion independent from authorization concerns', () => {
    expect(() =>
      publishCourseVersionInputSchema.parse({
        courseVersionId: 'course-version-001',
        actorId: 'actor-001',
      }),
    ).toThrow();

    expect(() =>
      publishCourseVersionInputSchema.parse({
        courseVersionId: 'course-version-001',
        role: 'EDITOR',
      }),
    ).toThrow();
  });

  it('does not allow the caller to control PublishVersion lifecycle state', () => {
    expect(() =>
      publishCourseVersionInputSchema.parse({
        courseVersionId: 'course-version-001',
        status: 'PUBLISHED',
      }),
    ).toThrow();

    expect(() =>
      publishCourseVersionInputSchema.parse({
        courseVersionId: 'course-version-001',
        publishedAt: new Date(),
      }),
    ).toThrow();
  });

  it('exposes the PublishVersion input type through the public Course barrel', () => {
    const input: PublishCourseVersionInput = {
      courseVersionId: 'course-version-001',
    };

    expect(input.courseVersionId).toBe('course-version-001');
  });
});
