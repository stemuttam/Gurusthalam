import { describe, expect, it } from 'vitest';

import { CourseLevel } from '../../domain/enums/course-level.js';
import { CourseStatus } from '../../domain/enums/course-status.js';
import { CourseType } from '../../domain/enums/course-type.js';
import { CourseVisibility } from '../../domain/enums/course-visibility.js';

import { courseQueryInputSchema } from './course-query.validation.js';

describe('Course query validation contract', () => {
  it('reuses the canonical Course search defaults', () => {
    const result = courseQueryInputSchema.parse({});

    expect(result).toEqual({
      page: 1,
      limit: 20,
      sortOrder: 'desc',
    });
  });

  it('accepts the complete Course query contract', () => {
    const result = courseQueryInputSchema.parse({
      query: 'physics',
      status: CourseStatus.PUBLISHED,
      visibility: CourseVisibility.PUBLIC,
      level: CourseLevel.INTERMEDIATE,
      type: CourseType.SELF_PACED,
      instructorId: 'instructor-123',
      page: 2,
      limit: 25,
      sortBy: 'updatedAt',
      sortOrder: 'asc',
    });

    expect(result).toEqual({
      query: 'physics',
      status: CourseStatus.PUBLISHED,
      visibility: CourseVisibility.PUBLIC,
      level: CourseLevel.INTERMEDIATE,
      type: CourseType.SELF_PACED,
      instructorId: 'instructor-123',
      page: 2,
      limit: 25,
      sortBy: 'updatedAt',
      sortOrder: 'asc',
    });
  });

  it('rejects unsupported query fields', () => {
    expect(() =>
      courseQueryInputSchema.parse({
        query: 'physics',
        unsupported: true,
      }),
    ).toThrow();
  });

  it('preserves the Course enum validation rules', () => {
    expect(
      courseQueryInputSchema.parse({
        status: CourseStatus.DRAFT,
        visibility: CourseVisibility.PRIVATE,
        level: CourseLevel.BEGINNER,
        type: CourseType.SELF_PACED,
      }),
    ).toMatchObject({
      status: CourseStatus.DRAFT,
      visibility: CourseVisibility.PRIVATE,
      level: CourseLevel.BEGINNER,
      type: CourseType.SELF_PACED,
    });
  });

  it('preserves pagination validation rules', () => {
    expect(() =>
      courseQueryInputSchema.parse({
        page: 0,
      }),
    ).toThrow();

    expect(() =>
      courseQueryInputSchema.parse({
        limit: 101,
      }),
    ).toThrow();
  });

  it('preserves sorting validation rules', () => {
    expect(
      courseQueryInputSchema.parse({
        sortBy: 'updatedAt',
        sortOrder: 'asc',
      }),
    ).toMatchObject({
      sortBy: 'updatedAt',
      sortOrder: 'asc',
    });

    expect(() =>
      courseQueryInputSchema.parse({
        sortBy: 'unsupportedField',
      }),
    ).toThrow();
  });
});
