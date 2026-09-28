import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type {
  CourseCatalogProjection,
  CourseSearchProjection,
} from '@gurusthalam/courses';

import { PrismaService } from '../../prisma.service.js';

import {
  PrismaCourseCatalogProjectionPersistence,
  PrismaCourseSearchProjectionPersistence,
} from './index.js';

describe('Course read-model PostgreSQL persistence', () => {
  const prisma = new PrismaService();

  const catalogPersistence = new PrismaCourseCatalogProjectionPersistence(
    prisma,
  );

  const searchPersistence = new PrismaCourseSearchProjectionPersistence(prisma);

  const catalogProjection: CourseCatalogProjection = {
    courseId: 'course-read-model-integration-001',
    title: 'Introduction to Physics',
    description: 'Mechanics and motion.',
    level: 'BEGINNER',
    type: 'SELF_PACED',
    visibility: 'PUBLIC',
    status: 'PUBLISHED',
    instructorId: 'instructor-001',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    projectionSchemaVersion: 1,
  };

  const searchProjection: CourseSearchProjection = {
    ...catalogProjection,
    searchText: 'Introduction to Physics Mechanics and motion.',
    searchProjectionSchemaVersion: 1,
  };

  beforeEach(async () => {
    await prisma.courseSearchProjection.deleteMany({
      where: {
        courseId: catalogProjection.courseId,
      },
    });

    await prisma.courseCatalogProjection.deleteMany({
      where: {
        courseId: catalogProjection.courseId,
      },
    });
  });

  afterAll(async () => {
    await prisma.courseSearchProjection.deleteMany({
      where: {
        courseId: catalogProjection.courseId,
      },
    });

    await prisma.courseCatalogProjection.deleteMany({
      where: {
        courseId: catalogProjection.courseId,
      },
    });

    await prisma.$disconnect();
  });

  it('persists and retrieves the canonical CourseCatalog projection', async () => {
    await catalogPersistence.upsert(catalogProjection);

    const persisted = await catalogPersistence.findByCourseId(
      catalogProjection.courseId,
    );

    expect(persisted).toEqual(catalogProjection);
  });

  it('persists and retrieves the CourseSearch projection', async () => {
    await searchPersistence.upsert(searchProjection);

    const persisted = await searchPersistence.findByCourseId(
      searchProjection.courseId,
    );

    expect(persisted).toEqual(searchProjection);
  });

  it('keeps catalog and search projections independently persisted', async () => {
    await catalogPersistence.upsert(catalogProjection);

    expect(
      await searchPersistence.findByCourseId(searchProjection.courseId),
    ).toBeNull();

    await searchPersistence.upsert(searchProjection);

    expect(
      await catalogPersistence.findByCourseId(catalogProjection.courseId),
    ).not.toBeNull();

    expect(
      await searchPersistence.findByCourseId(searchProjection.courseId),
    ).not.toBeNull();
  });

  it('supports idempotent catalog projection replay', async () => {
    await catalogPersistence.upsert(catalogProjection);
    await catalogPersistence.upsert(catalogProjection);

    const persisted = await catalogPersistence.findByCourseId(
      catalogProjection.courseId,
    );

    expect(persisted).toEqual(catalogProjection);

    const count = await prisma.courseCatalogProjection.count({
      where: {
        courseId: catalogProjection.courseId,
      },
    });

    expect(count).toBe(1);
  });

  it('supports idempotent search projection replay', async () => {
    await searchPersistence.upsert(searchProjection);
    await searchPersistence.upsert(searchProjection);

    const persisted = await searchPersistence.findByCourseId(
      searchProjection.courseId,
    );

    expect(persisted).toEqual(searchProjection);

    const count = await prisma.courseSearchProjection.count({
      where: {
        courseId: searchProjection.courseId,
      },
    });

    expect(count).toBe(1);
  });

  it('updates an existing catalog projection without changing its identity', async () => {
    await catalogPersistence.upsert(catalogProjection);

    const updated: CourseCatalogProjection = {
      ...catalogProjection,
      title: 'Advanced Physics',
      description: 'Advanced mechanics and motion.',
      level: 'ADVANCED',
      updatedAt: new Date('2026-01-03T00:00:00.000Z'),
    };

    await catalogPersistence.upsert(updated);

    const persisted = await catalogPersistence.findByCourseId(
      catalogProjection.courseId,
    );

    expect(persisted).toEqual(updated);

    const count = await prisma.courseCatalogProjection.count({
      where: {
        courseId: catalogProjection.courseId,
      },
    });

    expect(count).toBe(1);
  });

  it('updates an existing search projection including search representation', async () => {
    await searchPersistence.upsert(searchProjection);

    const updated: CourseSearchProjection = {
      ...searchProjection,
      title: 'Advanced Physics',
      description: 'Advanced mechanics and motion.',
      level: 'ADVANCED',
      searchText: 'Advanced Physics Advanced mechanics and motion.',
      updatedAt: new Date('2026-01-03T00:00:00.000Z'),
    };

    await searchPersistence.upsert(updated);

    const persisted = await searchPersistence.findByCourseId(
      searchProjection.courseId,
    );

    expect(persisted).toEqual(updated);
  });

  it('returns null for a missing catalog projection', async () => {
    await expect(
      catalogPersistence.findByCourseId('course-read-model-missing'),
    ).resolves.toBeNull();
  });

  it('returns null for a missing search projection', async () => {
    await expect(
      searchPersistence.findByCourseId('course-read-model-missing'),
    ).resolves.toBeNull();
  });

  it('removes the catalog projection without touching search persistence', async () => {
    await catalogPersistence.upsert(catalogProjection);
    await searchPersistence.upsert(searchProjection);

    await catalogPersistence.removeByCourseId(catalogProjection.courseId);

    expect(
      await catalogPersistence.findByCourseId(catalogProjection.courseId),
    ).toBeNull();

    expect(
      await searchPersistence.findByCourseId(searchProjection.courseId),
    ).toEqual(searchProjection);
  });

  it('removes the search projection without touching catalog persistence', async () => {
    await catalogPersistence.upsert(catalogProjection);
    await searchPersistence.upsert(searchProjection);

    await searchPersistence.removeByCourseId(searchProjection.courseId);

    expect(
      await searchPersistence.findByCourseId(searchProjection.courseId),
    ).toBeNull();

    expect(
      await catalogPersistence.findByCourseId(catalogProjection.courseId),
    ).toEqual(catalogProjection);
  });

  it('does not require the transactional Course row to exist', async () => {
    await catalogPersistence.upsert(catalogProjection);

    const persisted = await catalogPersistence.findByCourseId(
      catalogProjection.courseId,
    );

    expect(persisted).toEqual(catalogProjection);

    expect(
      await prisma.course.findUnique({
        where: {
          id: catalogProjection.courseId,
        },
      }),
    ).toBeNull();
  });
});
