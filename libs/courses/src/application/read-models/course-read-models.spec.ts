import { describe, expect, it } from 'vitest';

import {
  COURSE_CATALOG_PROJECTION_SCHEMA_VERSION,
  COURSE_SEARCH_PROJECTION_SCHEMA_VERSION,
  COURSE_SEARCH_SOURCE_CATALOG_SCHEMA_VERSION,
  createCourseCatalogProjection,
  createCourseSearchProjection,
  createCourseSearchText,
} from './index.js';

describe('Course read-model projections', () => {
  const catalogInput = {
    courseId: 'course-001',
    title: '  Introduction   to Physics  ',
    description: '  Mechanics and motion.  ',
    level: 'BEGINNER' as const,
    type: 'SELF_PACED' as const,
    visibility: 'PUBLIC' as const,
    status: 'PUBLISHED' as const,
    instructorId: 'instructor-001',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  };

  it('creates the canonical CourseCatalog projection without aggregate behavior', () => {
    const projection = createCourseCatalogProjection(catalogInput);

    expect(projection).toEqual({
      courseId: 'course-001',
      title: '  Introduction   to Physics  ',
      description: '  Mechanics and motion.  ',
      level: 'BEGINNER',
      type: 'SELF_PACED',
      visibility: 'PUBLIC',
      status: 'PUBLISHED',
      instructorId: 'instructor-001',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      projectionSchemaVersion: COURSE_CATALOG_PROJECTION_SCHEMA_VERSION,
    });
  });

  it('does not expose mutable Date instances from the input', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const updatedAt = new Date('2026-01-02T00:00:00.000Z');

    const projection = createCourseCatalogProjection({
      ...catalogInput,
      createdAt,
      updatedAt,
    });

    createdAt.setUTCFullYear(2030);
    updatedAt.setUTCFullYear(2030);

    expect(projection.createdAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));

    expect(projection.updatedAt).toEqual(new Date('2026-01-02T00:00:00.000Z'));
  });

  it('creates deterministic Course search text', () => {
    expect(
      createCourseSearchText({
        title: '  Introduction   to Physics  ',
        description: '  Mechanics   and motion. ',
      }),
    ).toBe('Introduction to Physics Mechanics and motion.');
  });

  it('does not create empty search fragments', () => {
    expect(
      createCourseSearchText({
        title: '  Physics ',
        description: null,
      }),
    ).toBe('Physics');

    expect(
      createCourseSearchText({
        title: '   ',
        description: null,
      }),
    ).toBe('');
  });

  it('derives CourseSearchProjection from CourseCatalogProjection', () => {
    const catalog = createCourseCatalogProjection(catalogInput);

    const search = createCourseSearchProjection(catalog);

    expect(search.courseId).toBe(catalog.courseId);
    expect(search.title).toBe(catalog.title);
    expect(search.description).toBe(catalog.description);
    expect(search.level).toBe(catalog.level);
    expect(search.type).toBe(catalog.type);
    expect(search.visibility).toBe(catalog.visibility);
    expect(search.status).toBe(catalog.status);
    expect(search.instructorId).toBe(catalog.instructorId);
    expect(search.createdAt).toEqual(catalog.createdAt);
    expect(search.updatedAt).toEqual(catalog.updatedAt);

    expect(search.searchText).toBe(
      'Introduction to Physics Mechanics and motion.',
    );

    expect(search.searchProjectionSchemaVersion).toBe(
      COURSE_SEARCH_PROJECTION_SCHEMA_VERSION,
    );

    expect(COURSE_SEARCH_SOURCE_CATALOG_SCHEMA_VERSION).toBe(
      COURSE_CATALOG_PROJECTION_SCHEMA_VERSION,
    );
  });

  it('allows a deterministic search representation to be explicitly supplied', () => {
    const catalog = createCourseCatalogProjection(catalogInput);

    const search = createCourseSearchProjection(catalog, {
      searchText: 'physics mechanics motion',
    });

    expect(search.searchText).toBe('physics mechanics motion');
  });

  it('returns immutable projection objects', () => {
    const catalog = createCourseCatalogProjection(catalogInput);
    const search = createCourseSearchProjection(catalog);

    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(search)).toBe(true);
  });

  it('keeps projection creation independent from persistence infrastructure', () => {
    const catalog = createCourseCatalogProjection(catalogInput);
    const search = createCourseSearchProjection(catalog);

    expect(catalog).not.toHaveProperty('prisma');
    expect(search).not.toHaveProperty('prisma');

    expect(catalog).not.toHaveProperty('embedding');
    expect(search).not.toHaveProperty('embedding');

    expect(catalog).not.toHaveProperty('vectorId');
    expect(search).not.toHaveProperty('vectorId');

    expect(catalog).not.toHaveProperty('rankingScore');
    expect(search).not.toHaveProperty('rankingScore');

    expect(catalog).not.toHaveProperty('modelId');
    expect(search).not.toHaveProperty('modelId');
  });
});
