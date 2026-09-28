import { describe, expect, it, vi } from 'vitest';

import {
  COURSE_CATALOG_PROJECTION_SCHEMA_VERSION,
  COURSE_SEARCH_PROJECTION_SCHEMA_VERSION,
  createCourseCatalogProjection,
  createCourseSearchProjection,
} from './index.js';
import type {
  CourseCatalogProjectionPersistence,
  CourseProjectionPersistence,
  CourseSearchProjectionPersistence,
} from './course-projection.persistence.js';

describe('Course projection persistence contracts', () => {
  const catalogProjection = createCourseCatalogProjection({
    courseId: 'course-001',
    title: 'Introduction to Physics',
    description: 'Mechanics and motion.',
    level: 'BEGINNER',
    type: 'SELF_PACED',
    visibility: 'PUBLIC',
    status: 'PUBLISHED',
    instructorId: 'instructor-001',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  });

  const searchProjection = createCourseSearchProjection(catalogProjection);

  it('defines a catalog persistence boundary around the canonical projection', async () => {
    const persistence: CourseCatalogProjectionPersistence = {
      upsert: vi.fn(),
      findByCourseId: vi.fn().mockResolvedValue(catalogProjection),
      removeByCourseId: vi.fn(),
    };

    await persistence.upsert(catalogProjection);

    const result = await persistence.findByCourseId('course-001');

    await persistence.removeByCourseId('course-001');

    expect(persistence.upsert).toHaveBeenCalledWith(catalogProjection);
    expect(result).toBe(catalogProjection);
    expect(persistence.removeByCourseId).toHaveBeenCalledWith('course-001');
  });

  it('defines a search persistence boundary around the canonical search projection', async () => {
    const persistence: CourseSearchProjectionPersistence = {
      upsert: vi.fn(),
      findByCourseId: vi.fn().mockResolvedValue(searchProjection),
      removeByCourseId: vi.fn(),
    };

    await persistence.upsert(searchProjection);

    const result = await persistence.findByCourseId('course-001');

    await persistence.removeByCourseId('course-001');

    expect(persistence.upsert).toHaveBeenCalledWith(searchProjection);
    expect(result).toBe(searchProjection);
    expect(persistence.removeByCourseId).toHaveBeenCalledWith('course-001');
  });

  it('keeps catalog and search persistence independently replaceable', async () => {
    const catalogPersistence: CourseCatalogProjectionPersistence = {
      upsert: vi.fn(),
      findByCourseId: vi.fn().mockResolvedValue(catalogProjection),
      removeByCourseId: vi.fn(),
    };

    const searchPersistence: CourseSearchProjectionPersistence = {
      upsert: vi.fn(),
      findByCourseId: vi.fn().mockResolvedValue(searchProjection),
      removeByCourseId: vi.fn(),
    };

    const persistence: CourseProjectionPersistence = {
      catalog: catalogPersistence,
      search: searchPersistence,
    };

    await persistence.catalog.upsert(catalogProjection);
    await persistence.search.upsert(searchProjection);

    expect(persistence.catalog).not.toBe(persistence.search);
    expect(persistence.catalog.findByCourseId).not.toBe(
      persistence.search.findByCourseId,
    );
  });

  it('preserves projection schema versions at the persistence boundary', async () => {
    const catalogPersistence: CourseCatalogProjectionPersistence = {
      upsert: vi.fn(),
      findByCourseId: vi.fn().mockResolvedValue(catalogProjection),
      removeByCourseId: vi.fn(),
    };

    const searchPersistence: CourseSearchProjectionPersistence = {
      upsert: vi.fn(),
      findByCourseId: vi.fn().mockResolvedValue(searchProjection),
      removeByCourseId: vi.fn(),
    };

    await catalogPersistence.upsert(catalogProjection);
    await searchPersistence.upsert(searchProjection);

    expect(catalogProjection.projectionSchemaVersion).toBe(
      COURSE_CATALOG_PROJECTION_SCHEMA_VERSION,
    );

    expect(searchProjection.searchProjectionSchemaVersion).toBe(
      COURSE_SEARCH_PROJECTION_SCHEMA_VERSION,
    );

    expect(catalogPersistence.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        projectionSchemaVersion: COURSE_CATALOG_PROJECTION_SCHEMA_VERSION,
      }),
    );

    expect(searchPersistence.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        searchProjectionSchemaVersion: COURSE_SEARCH_PROJECTION_SCHEMA_VERSION,
      }),
    );
  });

  it('represents missing projections with null rather than exceptions', async () => {
    const catalogPersistence: CourseCatalogProjectionPersistence = {
      upsert: vi.fn(),
      findByCourseId: vi.fn().mockResolvedValue(null),
      removeByCourseId: vi.fn(),
    };

    const searchPersistence: CourseSearchProjectionPersistence = {
      upsert: vi.fn(),
      findByCourseId: vi.fn().mockResolvedValue(null),
      removeByCourseId: vi.fn(),
    };

    await expect(
      catalogPersistence.findByCourseId('missing-course'),
    ).resolves.toBeNull();

    await expect(
      searchPersistence.findByCourseId('missing-course'),
    ).resolves.toBeNull();
  });

  it('does not require persistence implementations to expose Prisma or search infrastructure', () => {
    const catalogPersistence: CourseCatalogProjectionPersistence = {
      upsert: vi.fn(),
      findByCourseId: vi.fn().mockResolvedValue(null),
      removeByCourseId: vi.fn(),
    };

    const searchPersistence: CourseSearchProjectionPersistence = {
      upsert: vi.fn(),
      findByCourseId: vi.fn().mockResolvedValue(null),
      removeByCourseId: vi.fn(),
    };

    expect(catalogPersistence).not.toHaveProperty('prisma');
    expect(catalogPersistence).not.toHaveProperty('database');

    expect(searchPersistence).not.toHaveProperty('prisma');
    expect(searchPersistence).not.toHaveProperty('searchClient');
    expect(searchPersistence).not.toHaveProperty('embeddingClient');
    expect(searchPersistence).not.toHaveProperty('vectorStore');
  });

  it('keeps persistence contracts independent from aggregate mutation behavior', () => {
    expect(catalogProjection).not.toHaveProperty('transition');
    expect(catalogProjection).not.toHaveProperty('publish');
    expect(catalogProjection).not.toHaveProperty('archive');

    expect(searchProjection).not.toHaveProperty('transition');
    expect(searchProjection).not.toHaveProperty('publish');
    expect(searchProjection).not.toHaveProperty('archive');
  });
});
