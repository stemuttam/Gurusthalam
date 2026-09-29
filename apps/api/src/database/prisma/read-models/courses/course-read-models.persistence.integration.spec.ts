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

describe('Course read-model PostgreSQL persistence — 4.14-G', () => {
  const prisma = new PrismaService();

  const catalogPersistence = new PrismaCourseCatalogProjectionPersistence(
    prisma,
  );

  const searchPersistence = new PrismaCourseSearchProjectionPersistence(prisma);

  const courseId = 'course-read-model-g-regression-001';

  const baseCatalogProjection: CourseCatalogProjection = {
    courseId,
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

  const baseSearchProjection: CourseSearchProjection = {
    ...baseCatalogProjection,
    searchText: 'Introduction to Physics Mechanics and motion.',
    searchProjectionSchemaVersion: 1,
  };

  function catalogAt(
    updatedAt: string,
    overrides: Partial<CourseCatalogProjection> = {},
  ): CourseCatalogProjection {
    return {
      ...baseCatalogProjection,
      ...overrides,
      updatedAt: new Date(updatedAt),
    };
  }

  function searchAt(
    updatedAt: string,
    overrides: Partial<CourseSearchProjection> = {},
  ): CourseSearchProjection {
    return {
      ...baseSearchProjection,
      ...overrides,
      updatedAt: new Date(updatedAt),
    };
  }

  function latestCatalogProjection(
    projections: readonly CourseCatalogProjection[],
  ): CourseCatalogProjection {
    const latest = projections.reduce<CourseCatalogProjection | undefined>(
      (current, projection) => {
        if (
          current === undefined ||
          projection.updatedAt.getTime() > current.updatedAt.getTime()
        ) {
          return projection;
        }

        return current;
      },
      undefined,
    );

    if (latest === undefined) {
      throw new Error('Expected at least one catalog projection.');
    }

    return latest;
  }

  function latestSearchProjection(
    projections: readonly CourseSearchProjection[],
  ): CourseSearchProjection {
    const latest = projections.reduce<CourseSearchProjection | undefined>(
      (current, projection) => {
        if (
          current === undefined ||
          projection.updatedAt.getTime() > current.updatedAt.getTime()
        ) {
          return projection;
        }

        return current;
      },
      undefined,
    );

    if (latest === undefined) {
      throw new Error('Expected at least one search projection.');
    }

    return latest;
  }

  async function clearProjectionRows(): Promise<void> {
    await prisma.courseSearchProjection.deleteMany({
      where: {
        courseId,
      },
    });

    await prisma.courseCatalogProjection.deleteMany({
      where: {
        courseId,
      },
    });
  }

  beforeEach(async () => {
    await clearProjectionRows();
  });

  afterAll(async () => {
    await clearProjectionRows();
    await prisma.$disconnect();
  });

  /*
   * --------------------------------------------------------------------------
   * G1 — G10
   * Deterministic replay, ordering and lifecycle independence
   * --------------------------------------------------------------------------
   */

  it('G1 — creates a catalog projection on first write', async () => {
    const applied = await catalogPersistence.upsert(baseCatalogProjection);

    expect(applied).toBe(true);

    await expect(catalogPersistence.findByCourseId(courseId)).resolves.toEqual(
      baseCatalogProjection,
    );
  });

  it('G2 — replays the same catalog projection idempotently', async () => {
    await catalogPersistence.upsert(baseCatalogProjection);

    const replayResults = await Promise.all(
      Array.from({ length: 10 }, () =>
        catalogPersistence.upsert(baseCatalogProjection),
      ),
    );

    expect(replayResults.every(Boolean)).toBe(true);

    expect(
      await prisma.courseCatalogProjection.count({
        where: {
          courseId,
        },
      }),
    ).toBe(1);

    await expect(catalogPersistence.findByCourseId(courseId)).resolves.toEqual(
      baseCatalogProjection,
    );
  });

  it('G3 — accepts an equal-timestamp deterministic replay', async () => {
    await catalogPersistence.upsert(baseCatalogProjection);

    const replay = catalogAt('2026-01-02T00:00:00.000Z', {
      title: baseCatalogProjection.title,
      description: baseCatalogProjection.description,
    });

    await expect(catalogPersistence.upsert(replay)).resolves.toBe(true);

    await expect(catalogPersistence.findByCourseId(courseId)).resolves.toEqual(
      replay,
    );
  });

  it('G4 — accepts a newer catalog projection', async () => {
    await catalogPersistence.upsert(baseCatalogProjection);

    const newer = catalogAt('2026-01-03T00:00:00.000Z', {
      title: 'Advanced Physics',
      description: 'Advanced mechanics and motion.',
      level: 'ADVANCED',
    });

    await expect(catalogPersistence.upsert(newer)).resolves.toBe(true);

    await expect(catalogPersistence.findByCourseId(courseId)).resolves.toEqual(
      newer,
    );
  });

  it('G5 — rejects an older catalog projection', async () => {
    const newer = catalogAt('2026-01-03T00:00:00.000Z', {
      title: 'Advanced Physics',
    });

    const older = catalogAt('2026-01-01T00:00:00.000Z', {
      title: 'Old Physics',
    });

    await catalogPersistence.upsert(newer);

    await expect(catalogPersistence.upsert(older)).resolves.toBe(false);

    await expect(catalogPersistence.findByCourseId(courseId)).resolves.toEqual(
      newer,
    );
  });

  it('G6 — rejects stale replay after a newer state has been persisted', async () => {
    const initial = catalogAt('2026-01-02T00:00:00.000Z', {
      title: 'Initial Physics',
    });

    const newer = catalogAt('2026-01-04T00:00:00.000Z', {
      title: 'Newest Physics',
    });

    await catalogPersistence.upsert(initial);
    await catalogPersistence.upsert(newer);

    const staleReplay = await catalogPersistence.upsert(initial);

    expect(staleReplay).toBe(false);

    await expect(catalogPersistence.findByCourseId(courseId)).resolves.toEqual(
      newer,
    );
  });

  it('G7 — returns null when the catalog projection is missing', async () => {
    await expect(
      catalogPersistence.findByCourseId(courseId),
    ).resolves.toBeNull();
  });

  it('G8 — removes only the catalog projection', async () => {
    await catalogPersistence.upsert(baseCatalogProjection);
    await searchPersistence.upsert(baseSearchProjection);

    await catalogPersistence.removeByCourseId(courseId);

    await expect(
      catalogPersistence.findByCourseId(courseId),
    ).resolves.toBeNull();

    await expect(searchPersistence.findByCourseId(courseId)).resolves.toEqual(
      baseSearchProjection,
    );
  });

  it('G9 — replays the same search projection idempotently', async () => {
    await searchPersistence.upsert(baseSearchProjection);

    const replayResults = await Promise.all(
      Array.from({ length: 10 }, () =>
        searchPersistence.upsert(baseSearchProjection),
      ),
    );

    expect(replayResults.every(Boolean)).toBe(true);

    expect(
      await prisma.courseSearchProjection.count({
        where: {
          courseId,
        },
      }),
    ).toBe(1);

    await expect(searchPersistence.findByCourseId(courseId)).resolves.toEqual(
      baseSearchProjection,
    );
  });

  it('G10 — rejects a stale search projection', async () => {
    const newer = searchAt('2026-01-04T00:00:00.000Z', {
      title: 'Newest Physics',
      searchText: 'Newest Physics',
    });

    const older = searchAt('2026-01-02T00:00:00.000Z', {
      title: 'Old Physics',
      searchText: 'Old Physics',
    });

    await searchPersistence.upsert(newer);

    await expect(searchPersistence.upsert(older)).resolves.toBe(false);

    await expect(searchPersistence.findByCourseId(courseId)).resolves.toEqual(
      newer,
    );
  });

  /*
   * --------------------------------------------------------------------------
   * G11 — G20
   * Database-level atomic concurrency boundary
   * --------------------------------------------------------------------------
   */

  it('G11 — safely converges concurrent catalog writes to the newest timestamp', async () => {
    const projections = Array.from({ length: 20 }, (_, index) =>
      catalogAt(`2026-01-01T00:00:${String(index).padStart(2, '0')}.000Z`, {
        title: `Physics ${index}`,
      }),
    );

    const expected = latestCatalogProjection(projections);

    await Promise.all(
      [...projections]
        .reverse()
        .map((projection) => catalogPersistence.upsert(projection)),
    );

    const persisted = await catalogPersistence.findByCourseId(courseId);

    expect(persisted).toEqual(expected);

    expect(
      await prisma.courseCatalogProjection.count({
        where: {
          courseId,
        },
      }),
    ).toBe(1);
  });

  it('G12 — safely converges concurrent search writes to the newest timestamp', async () => {
    const projections = Array.from({ length: 20 }, (_, index) =>
      searchAt(`2026-01-01T00:00:${String(index).padStart(2, '0')}.000Z`, {
        title: `Physics ${index}`,
        searchText: `Physics ${index}`,
      }),
    );

    const expected = latestSearchProjection(projections);

    await Promise.all(
      [...projections]
        .reverse()
        .map((projection) => searchPersistence.upsert(projection)),
    );

    const persisted = await searchPersistence.findByCourseId(courseId);

    expect(persisted).toEqual(expected);

    expect(
      await prisma.courseSearchProjection.count({
        where: {
          courseId,
        },
      }),
    ).toBe(1);
  });

  it('G13 — prevents an older concurrent catalog write from regressing state', async () => {
    const newer = catalogAt('2026-02-01T00:00:00.000Z', {
      title: 'Newest Physics',
    });

    const older = catalogAt('2026-01-01T00:00:00.000Z', {
      title: 'Old Physics',
    });

    /*
     * Establish the authoritative newer state before introducing
     * concurrent stale replays.
     *
     * This is critical for determinism. The test must not depend on
     * Promise.all() scheduling to determine which projection is inserted
     * first.
     */
    await expect(catalogPersistence.upsert(newer)).resolves.toBe(true);

    const results = await Promise.all([
      catalogPersistence.upsert(older),
      catalogPersistence.upsert(newer),
      catalogPersistence.upsert(older),
      catalogPersistence.upsert(newer),
    ]);

    /*
     * The older projections are unconditionally stale because the newer
     * projection already exists before the concurrent operations begin.
     */
    expect(results[0]).toBe(false);
    expect(results[2]).toBe(false);

    /*
     * Equal/newer deterministic replays remain accepted.
     */
    expect(results[1]).toBe(true);
    expect(results[3]).toBe(true);

    await expect(catalogPersistence.findByCourseId(courseId)).resolves.toEqual(
      newer,
    );
  });

  it('G14 — prevents an older concurrent search write from regressing state', async () => {
    const newer = searchAt('2026-02-01T00:00:00.000Z', {
      title: 'Newest Physics',
      searchText: 'Newest Physics',
    });

    const older = searchAt('2026-01-01T00:00:00.000Z', {
      title: 'Old Physics',
      searchText: 'Old Physics',
    });

    /*
     * IMPORTANT:
     *
     * G14 must establish the newer state BEFORE starting Promise.all().
     *
     * Without this setup, the older projection may legitimately win the
     * initial INSERT race. In that case:
     *
     *   older -> INSERT -> true
     *   newer -> UPDATE -> true
     *
     * and the result becomes:
     *
     *   [true, true, true, true]
     *
     * That does not demonstrate a broken production implementation; it
     * demonstrates that the test itself allowed an older projection to be
     * the first writer.
     *
     * Once newer is persisted first, every older concurrent write is
     * unconditionally stale and PostgreSQL must reject it.
     */
    await expect(searchPersistence.upsert(newer)).resolves.toBe(true);

    const results = await Promise.all([
      searchPersistence.upsert(older),
      searchPersistence.upsert(newer),
      searchPersistence.upsert(older),
      searchPersistence.upsert(newer),
    ]);

    /*
     * Both stale writes must be rejected.
     */
    expect(results[0]).toBe(false);
    expect(results[2]).toBe(false);

    /*
     * Both equal/newer deterministic replays must be accepted.
     */
    expect(results[1]).toBe(true);
    expect(results[3]).toBe(true);

    /*
     * Most importantly, stale concurrent writers must never regress
     * the persisted search read model.
     */
    await expect(searchPersistence.findByCourseId(courseId)).resolves.toEqual(
      newer,
    );
  });

  it('G15 — converges catalog state to the newest projection under shuffled concurrency', async () => {
    const projections = [
      catalogAt('2026-03-05T00:00:00.000Z', {
        title: 'Version 5',
      }),
      catalogAt('2026-03-01T00:00:00.000Z', {
        title: 'Version 1',
      }),
      catalogAt('2026-03-04T00:00:00.000Z', {
        title: 'Version 4',
      }),
      catalogAt('2026-03-02T00:00:00.000Z', {
        title: 'Version 2',
      }),
      catalogAt('2026-03-03T00:00:00.000Z', {
        title: 'Version 3',
      }),
    ];

    await Promise.all(
      projections.map((projection) => catalogPersistence.upsert(projection)),
    );

    await expect(catalogPersistence.findByCourseId(courseId)).resolves.toEqual(
      projections[0],
    );
  });

  it('G16 — concurrent catalog creation produces exactly one row', async () => {
    const projections = Array.from({ length: 50 }, () =>
      catalogAt('2026-04-01T00:00:00.000Z', {
        title: 'Concurrent Physics',
      }),
    );

    const results = await Promise.all(
      projections.map((projection) => catalogPersistence.upsert(projection)),
    );

    expect(results.every(Boolean)).toBe(true);

    expect(
      await prisma.courseCatalogProjection.count({
        where: {
          courseId,
        },
      }),
    ).toBe(1);

    await expect(catalogPersistence.findByCourseId(courseId)).resolves.toEqual(
      projections[0],
    );
  });

  it('G17 — concurrent search creation produces exactly one row', async () => {
    const projections = Array.from({ length: 50 }, () =>
      searchAt('2026-04-01T00:00:00.000Z', {
        title: 'Concurrent Physics',
        searchText: 'Concurrent Physics',
      }),
    );

    const results = await Promise.all(
      projections.map((projection) => searchPersistence.upsert(projection)),
    );

    expect(results.every(Boolean)).toBe(true);

    expect(
      await prisma.courseSearchProjection.count({
        where: {
          courseId,
        },
      }),
    ).toBe(1);

    await expect(searchPersistence.findByCourseId(courseId)).resolves.toEqual(
      projections[0],
    );
  });

  it('G18 — catalog and search identities remain independently isolated', async () => {
    await catalogPersistence.upsert(
      catalogAt('2026-05-01T00:00:00.000Z', {
        title: 'Catalog Physics',
      }),
    );

    await searchPersistence.upsert(
      searchAt('2026-06-01T00:00:00.000Z', {
        title: 'Search Physics',
        searchText: 'Search Physics',
      }),
    );

    await expect(
      catalogPersistence.findByCourseId(courseId),
    ).resolves.toMatchObject({
      title: 'Catalog Physics',
    });

    await expect(
      searchPersistence.findByCourseId(courseId),
    ).resolves.toMatchObject({
      title: 'Search Physics',
      searchText: 'Search Physics',
    });
  });

  it('G19 — projections remain independent from the transactional Course row', async () => {
    const projection = catalogAt('2026-07-01T00:00:00.000Z', {
      title: 'Independent Projection',
    });

    await expect(
      prisma.course.findUnique({
        where: {
          id: courseId,
        },
      }),
    ).resolves.toBeNull();

    await expect(catalogPersistence.upsert(projection)).resolves.toBe(true);

    await expect(catalogPersistence.findByCourseId(courseId)).resolves.toEqual(
      projection,
    );

    await expect(
      prisma.course.findUnique({
        where: {
          id: courseId,
        },
      }),
    ).resolves.toBeNull();
  });

  it('G20 — remains idempotent under high-contention duplicate replay', async () => {
    const projection = catalogAt('2026-08-01T00:00:00.000Z', {
      title: 'High Contention Physics',
      description: 'Replay-safe projection.',
    });

    await catalogPersistence.upsert(projection);

    const results = await Promise.all(
      Array.from({ length: 100 }, () => catalogPersistence.upsert(projection)),
    );

    expect(results.every(Boolean)).toBe(true);

    expect(
      await prisma.courseCatalogProjection.count({
        where: {
          courseId,
        },
      }),
    ).toBe(1);

    await expect(catalogPersistence.findByCourseId(courseId)).resolves.toEqual(
      projection,
    );
  });

  /*
   * --------------------------------------------------------------------------
   * Existing foundational persistence guarantees
   * --------------------------------------------------------------------------
   */

  it('preserves catalog/search independence when only catalog is written', async () => {
    await catalogPersistence.upsert(baseCatalogProjection);

    await expect(
      searchPersistence.findByCourseId(courseId),
    ).resolves.toBeNull();

    await expect(catalogPersistence.findByCourseId(courseId)).resolves.toEqual(
      baseCatalogProjection,
    );
  });

  it('preserves catalog/search independence when only search is written', async () => {
    await searchPersistence.upsert(baseSearchProjection);

    await expect(
      catalogPersistence.findByCourseId(courseId),
    ).resolves.toBeNull();

    await expect(searchPersistence.findByCourseId(courseId)).resolves.toEqual(
      baseSearchProjection,
    );
  });

  it('removes search without touching catalog', async () => {
    await catalogPersistence.upsert(baseCatalogProjection);
    await searchPersistence.upsert(baseSearchProjection);

    await searchPersistence.removeByCourseId(courseId);

    await expect(
      searchPersistence.findByCourseId(courseId),
    ).resolves.toBeNull();

    await expect(catalogPersistence.findByCourseId(courseId)).resolves.toEqual(
      baseCatalogProjection,
    );
  });
});
