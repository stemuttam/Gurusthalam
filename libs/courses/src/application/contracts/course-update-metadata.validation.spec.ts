import { describe, expect, it } from 'vitest';

import { CourseLevel } from '../../domain/enums/course-level.js';
import { CourseType } from '../../domain/enums/course-type.js';
import { CourseVisibility } from '../../domain/enums/course-visibility.js';

import {
  updateCourseInputSchema,
  updateMetadataInputSchema,
} from './course-application.validation.js';

describe('Course UpdateMetadata validation contract — 4.10-E', () => {
  it('uses the same schema contract as the backward-compatible UpdateCourse command', () => {
    expect(updateMetadataInputSchema).toBe(updateCourseInputSchema);
  });

  it('accepts a single mutable metadata field', () => {
    expect(
      updateMetadataInputSchema.parse({
        courseId: 'course-001',
        title: 'Updated Course',
      }),
    ).toEqual({
      courseId: 'course-001',
      title: 'Updated Course',
    });
  });

  it('accepts all mutable metadata fields', () => {
    expect(
      updateMetadataInputSchema.parse({
        courseId: 'course-001',
        title: 'Updated Course',
        description: 'Updated description.',
        level: CourseLevel.ADVANCED,
        type: CourseType.BLENDED,
        visibility: CourseVisibility.PUBLIC,
      }),
    ).toEqual({
      courseId: 'course-001',
      title: 'Updated Course',
      description: 'Updated description.',
      level: CourseLevel.ADVANCED,
      type: CourseType.BLENDED,
      visibility: CourseVisibility.PUBLIC,
    });
  });

  it('trims primitive string values before application orchestration', () => {
    expect(
      updateMetadataInputSchema.parse({
        courseId: '  course-001  ',
        title: '  Updated Course  ',
        description: '  Updated description.  ',
      }),
    ).toEqual({
      courseId: 'course-001',
      title: 'Updated Course',
      description: 'Updated description.',
    });
  });

  it('accepts an explicit null description', () => {
    expect(
      updateMetadataInputSchema.parse({
        courseId: 'course-001',
        description: null,
      }),
    ).toEqual({
      courseId: 'course-001',
      description: null,
    });
  });

  it('rejects an empty metadata command', () => {
    expect(() =>
      updateMetadataInputSchema.parse({
        courseId: 'course-001',
      }),
    ).toThrow('At least one Course metadata field must be provided.');
  });

  it('rejects authorization fields at the Course application boundary', () => {
    expect(() =>
      updateMetadataInputSchema.parse({
        courseId: 'course-001',
        title: 'Updated Course',
        actorId: 'actor-001',
      }),
    ).toThrow();
  });

  it('rejects lifecycle and identity mutation fields', () => {
    expect(() =>
      updateMetadataInputSchema.parse({
        courseId: 'course-001',
        title: 'Updated Course',
        status: 'PUBLISHED',
      }),
    ).toThrow();

    expect(() =>
      updateMetadataInputSchema.parse({
        courseId: 'course-001',
        title: 'Updated Course',
        instructorId: 'instructor-002',
      }),
    ).toThrow();
  });

  it('rejects invalid metadata enum values', () => {
    expect(() =>
      updateMetadataInputSchema.parse({
        courseId: 'course-001',
        level: 'INVALID',
      }),
    ).toThrow();

    expect(() =>
      updateMetadataInputSchema.parse({
        courseId: 'course-001',
        type: 'INVALID',
      }),
    ).toThrow();

    expect(() =>
      updateMetadataInputSchema.parse({
        courseId: 'course-001',
        visibility: 'INVALID',
      }),
    ).toThrow();
  });
});
