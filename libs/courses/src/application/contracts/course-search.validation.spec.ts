import { describe, expect, it } from 'vitest';

import { CourseLevel } from '../../domain/enums/course-level.js';
import { CourseStatus } from '../../domain/enums/course-status.js';
import { CourseType } from '../../domain/enums/course-type.js';
import { CourseVisibility } from '../../domain/enums/course-visibility.js';

import { courseSearchInputSchema } from './course-search.validation.js';

describe('Course search validation contract', () => {
  it('accepts an empty search request and applies shared pagination defaults', () => {
    const result = courseSearchInputSchema.parse({});

    expect(result).toEqual({
      page: 1,
      limit: 20,
      sortOrder: 'desc',
    });
  });

  it('accepts a complete Course search request', () => {
    const result = courseSearchInputSchema.parse({
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

  it('trims the free-text query', () => {
    const result = courseSearchInputSchema.parse({
      query: '  physics  ',
    });

    expect(result.query).toBe('physics');
  });

  it('trims the instructor id', () => {
    const result = courseSearchInputSchema.parse({
      instructorId: '  instructor-123  ',
    });

    expect(result.instructorId).toBe('instructor-123');
  });

  it('rejects an empty query', () => {
    expect(() =>
      courseSearchInputSchema.parse({
        query: '',
      }),
    ).toThrow();
  });

  it('rejects a whitespace-only query', () => {
    expect(() =>
      courseSearchInputSchema.parse({
        query: '   ',
      }),
    ).toThrow();
  });

  it('rejects an empty instructor id', () => {
    expect(() =>
      courseSearchInputSchema.parse({
        instructorId: '',
      }),
    ).toThrow();
  });

  it('rejects a whitespace-only instructor id', () => {
    expect(() =>
      courseSearchInputSchema.parse({
        instructorId: '   ',
      }),
    ).toThrow();
  });

  it('accepts every supported Course search sort field', () => {
    const fields = [
      'title',
      'status',
      'level',
      'type',
      'visibility',
      'createdAt',
      'updatedAt',
    ] as const;

    for (const sortBy of fields) {
      expect(
        courseSearchInputSchema.parse({
          sortBy,
        }).sortBy,
      ).toBe(sortBy);
    }
  });

  it('rejects an unsupported sort field', () => {
    expect(() =>
      courseSearchInputSchema.parse({
        sortBy: 'instructorId',
      }),
    ).toThrow();
  });

  it('accepts ascending ordering', () => {
    const result = courseSearchInputSchema.parse({
      sortOrder: 'asc',
    });

    expect(result.sortOrder).toBe('asc');
  });

  it('accepts descending ordering', () => {
    const result = courseSearchInputSchema.parse({
      sortOrder: 'desc',
    });

    expect(result.sortOrder).toBe('desc');
  });

  it('rejects an invalid sort order', () => {
    expect(() =>
      courseSearchInputSchema.parse({
        sortOrder: 'invalid',
      }),
    ).toThrow();
  });

  it('rejects page zero', () => {
    expect(() =>
      courseSearchInputSchema.parse({
        page: 0,
      }),
    ).toThrow();
  });

  it('rejects a negative page', () => {
    expect(() =>
      courseSearchInputSchema.parse({
        page: -1,
      }),
    ).toThrow();
  });

  it('rejects a zero limit', () => {
    expect(() =>
      courseSearchInputSchema.parse({
        limit: 0,
      }),
    ).toThrow();
  });

  it('rejects a limit above the shared maximum', () => {
    expect(() =>
      courseSearchInputSchema.parse({
        limit: 101,
      }),
    ).toThrow();
  });

  it('accepts the shared maximum page size', () => {
    const result = courseSearchInputSchema.parse({
      limit: 100,
    });

    expect(result.limit).toBe(100);
  });

  it('coerces numeric pagination input', () => {
    const result = courseSearchInputSchema.parse({
      page: '3',
      limit: '50',
    });

    expect(result.page).toBe(3);
    expect(result.limit).toBe(50);
  });

  it('rejects unexpected fields', () => {
    expect(() =>
      courseSearchInputSchema.parse({
        query: 'physics',
        unsupported: true,
      }),
    ).toThrow();
  });

  it('accepts valid Course enum filters', () => {
    const result = courseSearchInputSchema.parse({
      status: CourseStatus.DRAFT,
      visibility: CourseVisibility.PRIVATE,
      level: CourseLevel.BEGINNER,
      type: CourseType.SELF_PACED,
    });

    expect(result.status).toBe(CourseStatus.DRAFT);
    expect(result.visibility).toBe(CourseVisibility.PRIVATE);
    expect(result.level).toBe(CourseLevel.BEGINNER);
    expect(result.type).toBe(CourseType.SELF_PACED);
  });

  it('rejects invalid Course enum filters', () => {
    expect(() =>
      courseSearchInputSchema.parse({
        status: 'INVALID',
      }),
    ).toThrow();

    expect(() =>
      courseSearchInputSchema.parse({
        visibility: 'INVALID',
      }),
    ).toThrow();

    expect(() =>
      courseSearchInputSchema.parse({
        level: 'INVALID',
      }),
    ).toThrow();

    expect(() =>
      courseSearchInputSchema.parse({
        type: 'INVALID',
      }),
    ).toThrow();
  });
});
