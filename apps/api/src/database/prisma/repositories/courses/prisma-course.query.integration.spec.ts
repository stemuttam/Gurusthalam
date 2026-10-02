import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { CourseQueryRequest } from '@gurusthalam/courses';

import { PrismaService } from '../../prisma.service.js';

import { PrismaCourseQuery } from './prisma-course.query.js';

describe('PrismaCourseQuery — PostgreSQL integration — 4.14-H', () => {
  const prisma = new PrismaService();

  const query = new PrismaCourseQuery(prisma);

  const courseIdPrefix = 'course-query-4-14-h-';
  const testInstructorId = 'course-query-4-14-h-test-instructor';

  function courseId(suffix: string): string {
    return `${courseIdPrefix}${suffix}`;
  }

  function projection(
    suffix: string,
    overrides: {
      title?: string;
      description?: string | null;
      level?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'ALL_LEVELS';
      type?: 'SELF_PACED' | 'LIVE' | 'BLENDED';
      visibility?: 'PRIVATE' | 'UNLISTED' | 'PUBLIC';
      status?: 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'UNPUBLISHED' | 'ARCHIVED';
      instructorId?: string;
      createdAt?: Date;
      updatedAt?: Date;
    } = {},
  ) {
    return {
      courseId: courseId(suffix),
      title: overrides.title ?? `Course ${suffix}`,
      description:
        overrides.description === undefined
          ? `Description for course ${suffix}`
          : overrides.description,
      level: overrides.level ?? 'BEGINNER',
      type: overrides.type ?? 'SELF_PACED',
      visibility: overrides.visibility ?? 'PUBLIC',
      status: overrides.status ?? 'PUBLISHED',
      instructorId: overrides.instructorId ?? testInstructorId,
      createdAt: overrides.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: overrides.updatedAt ?? new Date('2026-01-02T00:00:00.000Z'),
      projectionSchemaVersion: 1,
    };
  }

  async function clearRows(): Promise<void> {
    await prisma.courseCatalogProjection.deleteMany({
      where: {
        courseId: {
          startsWith: courseIdPrefix,
        },
      },
    });
  }

  async function seed(
    projections: readonly ReturnType<typeof projection>[],
  ): Promise<void> {
    await prisma.courseCatalogProjection.createMany({
      data: [...projections],
    });
  }

  async function search(overrides: Partial<CourseQueryRequest> = {}) {
    const request: CourseQueryRequest = {
      page: 1,
      limit: 20,
      instructorId: testInstructorId,
      ...overrides,
    };

    return query.search(request);
  }

  beforeEach(async () => {
    await clearRows();
  });

  afterAll(async () => {
    await clearRows();
    await prisma.$disconnect();
  });

  /*
   * --------------------------------------------------------------------------
   * H1 — H6
   * Pagination metadata and page boundaries
   * --------------------------------------------------------------------------
   */

  it('H1 — returns the first page with correct pagination metadata', async () => {
    await seed([
      projection('001'),
      projection('002'),
      projection('003'),
      projection('004'),
      projection('005'),
    ]);

    const result = await search({
      page: 1,
      limit: 2,
    });

    expect(result.items).toHaveLength(2);

    expect(result.meta).toEqual({
      page: 1,
      limit: 2,
      total: 5,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: false,
    });
  });

  it('H2 — returns the second page without overlapping the first page', async () => {
    await seed([
      projection('001', {
        createdAt: new Date('2026-01-01T00:00:01.000Z'),
      }),
      projection('002', {
        createdAt: new Date('2026-01-01T00:00:02.000Z'),
      }),
      projection('003', {
        createdAt: new Date('2026-01-01T00:00:03.000Z'),
      }),
      projection('004', {
        createdAt: new Date('2026-01-01T00:00:04.000Z'),
      }),
      projection('005', {
        createdAt: new Date('2026-01-01T00:00:05.000Z'),
      }),
    ]);

    const firstPage = await search({
      page: 1,
      limit: 2,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });

    const secondPage = await search({
      page: 2,
      limit: 2,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });

    expect(firstPage.items.map((item) => item.id)).toEqual([
      courseId('001'),
      courseId('002'),
    ]);

    expect(secondPage.items.map((item) => item.id)).toEqual([
      courseId('003'),
      courseId('004'),
    ]);

    expect(
      firstPage.items.some((item) =>
        secondPage.items.some((secondItem) => secondItem.id === item.id),
      ),
    ).toBe(false);
  });

  it('H3 — returns the final partial page with correct metadata', async () => {
    await seed([
      projection('001'),
      projection('002'),
      projection('003'),
      projection('004'),
      projection('005'),
    ]);

    const result = await search({
      page: 3,
      limit: 2,
    });

    expect(result.items).toHaveLength(1);

    expect(result.meta).toEqual({
      page: 3,
      limit: 2,
      total: 5,
      totalPages: 3,
      hasNextPage: false,
      hasPreviousPage: true,
    });
  });

  it('H4 — returns an empty page when the requested page is beyond the dataset', async () => {
    await seed([projection('001'), projection('002'), projection('003')]);

    const result = await search({
      page: 4,
      limit: 2,
    });

    expect(result.items).toEqual([]);

    expect(result.meta).toEqual({
      page: 4,
      limit: 2,
      total: 3,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true,
    });
  });

  it('H5 — reports zero total pages for an empty dataset', async () => {
    const result = await search({
      page: 1,
      limit: 20,
    });

    expect(result.items).toEqual([]);

    expect(result.meta).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  it('H6 — calculates totalPages using the filtered dataset', async () => {
    await seed([
      projection('001', {
        status: 'PUBLISHED',
      }),
      projection('002', {
        status: 'PUBLISHED',
      }),
      projection('003', {
        status: 'PUBLISHED',
      }),
      projection('004', {
        status: 'DRAFT',
      }),
      projection('005', {
        status: 'ARCHIVED',
      }),
    ]);

    const result = await search({
      page: 1,
      limit: 2,
      status: 'PUBLISHED',
    });

    expect(result.items).toHaveLength(2);

    expect(result.meta.total).toBe(3);
    expect(result.meta.totalPages).toBe(2);
    expect(result.meta.hasNextPage).toBe(true);
    expect(result.meta.hasPreviousPage).toBe(false);
  });

  /*
   * --------------------------------------------------------------------------
   * H7 — H12
   * Text and domain filters
   * --------------------------------------------------------------------------
   */

  it('H7 — filters by title using a case-insensitive text query', async () => {
    await seed([
      projection('001', {
        title: 'Introduction to Physics',
      }),
      projection('002', {
        title: 'Advanced Mathematics',
      }),
      projection('003', {
        title: 'Physics Laboratory',
      }),
    ]);

    const result = await search({
      query: 'PHYSICS',
    });

    expect(result.items.map((item) => item.id)).toEqual([
      courseId('003'),
      courseId('001'),
    ]);
  });

  it('H8 — filters by description using a case-insensitive text query', async () => {
    await seed([
      projection('001', {
        title: 'Mechanics',
        description: 'Newtonian mechanics and motion.',
      }),
      projection('002', {
        title: 'Geometry',
        description: 'Shapes, angles, and measurements.',
      }),
      projection('003', {
        title: 'Physics',
        description: 'Electric circuits and current.',
      }),
    ]);

    const result = await search({
      query: 'NEWTONIAN',
    });

    expect(result.items.map((item) => item.id)).toEqual([courseId('001')]);
  });

  it('H9 — filters by status', async () => {
    await seed([
      projection('001', {
        status: 'PUBLISHED',
      }),
      projection('002', {
        status: 'DRAFT',
      }),
      projection('003', {
        status: 'ARCHIVED',
      }),
    ]);

    const result = await search({
      status: 'DRAFT',
    });

    expect(result.items.map((item) => item.id)).toEqual([courseId('002')]);
  });

  it('H10 — filters by visibility', async () => {
    await seed([
      projection('001', {
        visibility: 'PUBLIC',
      }),
      projection('002', {
        visibility: 'PRIVATE',
      }),
      projection('003', {
        visibility: 'UNLISTED',
      }),
    ]);

    const result = await search({
      visibility: 'PRIVATE',
    });

    expect(result.items.map((item) => item.id)).toEqual([courseId('002')]);
  });

  it('H11 — filters by level and type', async () => {
    await seed([
      projection('001', {
        level: 'BEGINNER',
        type: 'SELF_PACED',
      }),
      projection('002', {
        level: 'ADVANCED',
        type: 'LIVE',
      }),
      projection('003', {
        level: 'ADVANCED',
        type: 'BLENDED',
      }),
    ]);

    const result = await search({
      level: 'ADVANCED',
      type: 'BLENDED',
    });

    expect(result.items.map((item) => item.id)).toEqual([courseId('003')]);
  });

  it('H12 — filters by instructorId', async () => {
    await seed([
      projection('001', {
        instructorId: 'instructor-001',
      }),
      projection('002', {
        instructorId: 'instructor-002',
      }),
      projection('003', {
        instructorId: 'instructor-001',
      }),
    ]);

    const result = await search({
      instructorId: 'instructor-001',
    });

    expect(result.items.map((item) => item.id)).toEqual([
      courseId('003'),
      courseId('001'),
    ]);
  });

  /*
   * --------------------------------------------------------------------------
   * H13 — H20
   * Sorting and deterministic secondary ordering
   * --------------------------------------------------------------------------
   */

  it('H13 — sorts by createdAt descending by default', async () => {
    await seed([
      projection('001', {
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
      projection('002', {
        createdAt: new Date('2026-01-03T00:00:00.000Z'),
      }),
      projection('003', {
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
      }),
    ]);

    const result = await search();

    expect(result.items.map((item) => item.id)).toEqual([
      courseId('002'),
      courseId('003'),
      courseId('001'),
    ]);
  });

  it('H14 — sorts by createdAt ascending', async () => {
    await seed([
      projection('001', {
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
      projection('002', {
        createdAt: new Date('2026-01-03T00:00:00.000Z'),
      }),
      projection('003', {
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
      }),
    ]);

    const result = await search({
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });

    expect(result.items.map((item) => item.id)).toEqual([
      courseId('001'),
      courseId('003'),
      courseId('002'),
    ]);
  });

  it('H15 — sorts by updatedAt descending', async () => {
    await seed([
      projection('001', {
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
      projection('002', {
        updatedAt: new Date('2026-01-03T00:00:00.000Z'),
      }),
      projection('003', {
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      }),
    ]);

    const result = await search({
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    });

    expect(result.items.map((item) => item.id)).toEqual([
      courseId('002'),
      courseId('003'),
      courseId('001'),
    ]);
  });

  it('H16 — sorts by title ascending', async () => {
    await seed([
      projection('001', {
        title: 'Zoology',
      }),
      projection('002', {
        title: 'Algebra',
      }),
      projection('003', {
        title: 'Biology',
      }),
    ]);

    const result = await search({
      sortBy: 'title',
      sortOrder: 'asc',
    });

    expect(result.items.map((item) => item.id)).toEqual([
      courseId('002'),
      courseId('003'),
      courseId('001'),
    ]);
  });

  it('H17 — sorts by title descending', async () => {
    await seed([
      projection('001', {
        title: 'Zoology',
      }),
      projection('002', {
        title: 'Algebra',
      }),
      projection('003', {
        title: 'Biology',
      }),
    ]);

    const result = await search({
      sortBy: 'title',
      sortOrder: 'desc',
    });

    expect(result.items.map((item) => item.id)).toEqual([
      courseId('001'),
      courseId('003'),
      courseId('002'),
    ]);
  });

  it('H18 — uses courseId as deterministic secondary ordering for equal createdAt values', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');

    await seed([
      projection('003', {
        createdAt,
      }),
      projection('001', {
        createdAt,
      }),
      projection('002', {
        createdAt,
      }),
    ]);

    const ascending = await search({
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });

    const descending = await search({
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(ascending.items.map((item) => item.id)).toEqual([
      courseId('001'),
      courseId('002'),
      courseId('003'),
    ]);

    expect(descending.items.map((item) => item.id)).toEqual([
      courseId('003'),
      courseId('002'),
      courseId('001'),
    ]);
  });

  it('H19 — uses courseId as deterministic secondary ordering for equal updatedAt values', async () => {
    const updatedAt = new Date('2026-02-01T00:00:00.000Z');

    await seed([
      projection('003', {
        updatedAt,
      }),
      projection('001', {
        updatedAt,
      }),
      projection('002', {
        updatedAt,
      }),
    ]);

    const ascending = await search({
      sortBy: 'updatedAt',
      sortOrder: 'asc',
    });

    const descending = await search({
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    });

    expect(ascending.items.map((item) => item.id)).toEqual([
      courseId('001'),
      courseId('002'),
      courseId('003'),
    ]);

    expect(descending.items.map((item) => item.id)).toEqual([
      courseId('003'),
      courseId('002'),
      courseId('001'),
    ]);
  });

  it('H20 — applies deterministic secondary ordering to equal titles', async () => {
    await seed([
      projection('003', {
        title: 'Physics',
      }),
      projection('001', {
        title: 'Physics',
      }),
      projection('002', {
        title: 'Physics',
      }),
    ]);

    const ascending = await search({
      sortBy: 'title',
      sortOrder: 'asc',
    });

    const descending = await search({
      sortBy: 'title',
      sortOrder: 'desc',
    });

    expect(ascending.items.map((item) => item.id)).toEqual([
      courseId('001'),
      courseId('002'),
      courseId('003'),
    ]);

    expect(descending.items.map((item) => item.id)).toEqual([
      courseId('003'),
      courseId('002'),
      courseId('001'),
    ]);
  });

  /*
   * --------------------------------------------------------------------------
   * H21 — H25
   * Combined filtering, sorting and pagination
   * --------------------------------------------------------------------------
   */

  it('H21 — combines text query, status and visibility filters', async () => {
    await seed([
      projection('001', {
        title: 'Physics Fundamentals',
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
      }),
      projection('002', {
        title: 'Physics Advanced',
        status: 'DRAFT',
        visibility: 'PUBLIC',
      }),
      projection('003', {
        title: 'Physics Laboratory',
        status: 'PUBLISHED',
        visibility: 'PRIVATE',
      }),
      projection('004', {
        title: 'Mathematics Fundamentals',
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
      }),
    ]);

    const result = await search({
      query: 'physics',
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
    });

    expect(result.items.map((item) => item.id)).toEqual([courseId('001')]);
  });

  it('H22 — combines level, type and instructor filters', async () => {
    await seed([
      projection('001', {
        level: 'ADVANCED',
        type: 'SELF_PACED',
        instructorId: 'instructor-001',
      }),
      projection('002', {
        level: 'ADVANCED',
        type: 'LIVE',
        instructorId: 'instructor-001',
      }),
      projection('003', {
        level: 'ADVANCED',
        type: 'SELF_PACED',
        instructorId: 'instructor-002',
      }),
      projection('004', {
        level: 'BEGINNER',
        type: 'SELF_PACED',
        instructorId: 'instructor-001',
      }),
    ]);

    const result = await search({
      level: 'ADVANCED',
      type: 'SELF_PACED',
      instructorId: 'instructor-001',
    });

    expect(result.items.map((item) => item.id)).toEqual([courseId('001')]);
  });

  it('H23 — combines filtering, sorting and pagination deterministically', async () => {
    await seed([
      projection('001', {
        title: 'Physics Fundamentals',
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
      projection('002', {
        title: 'Physics Advanced',
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        createdAt: new Date('2026-01-05T00:00:00.000Z'),
      }),
      projection('003', {
        title: 'Physics Laboratory',
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        createdAt: new Date('2026-01-04T00:00:00.000Z'),
      }),
      projection('004', {
        title: 'Physics Experiments',
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        createdAt: new Date('2026-01-03T00:00:00.000Z'),
      }),
      projection('005', {
        title: 'Physics Draft',
        status: 'DRAFT',
        visibility: 'PUBLIC',
        createdAt: new Date('2026-01-06T00:00:00.000Z'),
      }),
      projection('006', {
        title: 'Mathematics',
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        createdAt: new Date('2026-01-07T00:00:00.000Z'),
      }),
    ]);

    const result = await search({
      page: 2,
      limit: 2,
      query: 'physics',
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.items.map((item) => item.id)).toEqual([
      courseId('004'),
      courseId('001'),
    ]);

    expect(result.meta).toEqual({
      page: 2,
      limit: 2,
      total: 4,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true,
    });
  });

  it('H24 — returns the complete public query projection without persistence-only fields', async () => {
    await seed([
      projection('001', {
        title: 'Physics',
        description: 'Physics description.',
        level: 'INTERMEDIATE',
        type: 'BLENDED',
        visibility: 'PUBLIC',
        status: 'PUBLISHED',
      }),
    ]);

    const result = await search();

    expect(result.items).toEqual([
      {
        id: courseId('001'),
        title: 'Physics',
        description: 'Physics description.',
        level: 'INTERMEDIATE',
        type: 'BLENDED',
        visibility: 'PUBLIC',
        status: 'PUBLISHED',
        instructorId: testInstructorId,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      },
    ]);
  });
});
