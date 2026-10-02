import { describe, expect, it, vi } from 'vitest';

import type { PrismaClient } from '@gurusthalam/database';

import { PrismaCourseQuery } from './prisma-course.query.js';

describe('PrismaCourseQuery — 4.14-H', () => {
  const findMany = vi.fn();

  const count = vi.fn();

  const prisma = {
    courseCatalogProjection: {
      findMany,
      count,
    },
  } as unknown as PrismaClient;

  const query = new PrismaCourseQuery(prisma);

  const resetMocks = (): void => {
    findMany.mockReset();
    count.mockReset();
  };

  it('returns paginated CourseCatalog read-model projections', async () => {
    resetMocks();

    findMany.mockResolvedValue([
      {
        courseId: 'course-001',
        title: 'TypeScript Fundamentals',
        description: 'Learn TypeScript.',
        level: 'BEGINNER',
        type: 'SELF_PACED',
        visibility: 'PUBLIC',
        status: 'PUBLISHED',
        instructorId: 'instructor-001',
        createdAt: new Date('2026-01-01T10:00:00.000Z'),
        updatedAt: new Date('2026-01-02T10:00:00.000Z'),
      },
    ]);

    count.mockResolvedValue(21);

    const result = await query.search({
      page: 2,
      limit: 10,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    });

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(count).toHaveBeenCalledTimes(1);

    expect(result.items).toEqual([
      {
        id: 'course-001',
        title: 'TypeScript Fundamentals',
        description: 'Learn TypeScript.',
        level: 'BEGINNER',
        type: 'SELF_PACED',
        visibility: 'PUBLIC',
        status: 'PUBLISHED',
        instructorId: 'instructor-001',
        createdAt: new Date('2026-01-01T10:00:00.000Z'),
        updatedAt: new Date('2026-01-02T10:00:00.000Z'),
      },
    ]);

    expect(result.meta).toEqual({
      page: 2,
      limit: 10,
      total: 21,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it('queries the CourseCatalog projection instead of the transactional Course table', async () => {
    resetMocks();

    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await query.search({
      page: 1,
      limit: 20,
      sortOrder: 'desc',
    });

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(count).toHaveBeenCalledTimes(1);
  });

  it('applies free-text search across title and description', async () => {
    resetMocks();

    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await query.search({
      query: 'physics',
      page: 1,
      limit: 20,
      sortOrder: 'desc',
    });

    const expectedWhere = {
      OR: [
        {
          title: {
            contains: 'physics',
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: 'physics',
            mode: 'insensitive',
          },
        },
      ],
    };

    expect(findMany).toHaveBeenCalledWith({
      where: expectedWhere,

      orderBy: [
        {
          createdAt: 'desc',
        },
        {
          courseId: 'desc',
        },
      ],

      skip: 0,
      take: 20,

      select: {
        courseId: true,
        title: true,
        description: true,
        level: true,
        type: true,
        visibility: true,
        status: true,
        instructorId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    expect(count).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  });

  it('applies every supported structured filter', async () => {
    resetMocks();

    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await query.search({
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      level: 'INTERMEDIATE',
      type: 'SELF_PACED',
      instructorId: 'instructor-001',
      page: 1,
      limit: 25,
      sortBy: 'title',
      sortOrder: 'asc',
    });

    const expectedWhere = {
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      level: 'INTERMEDIATE',
      type: 'SELF_PACED',
      instructorId: 'instructor-001',
    };

    expect(findMany).toHaveBeenCalledWith({
      where: expectedWhere,

      orderBy: [
        {
          title: 'asc',
        },
        {
          courseId: 'asc',
        },
      ],

      skip: 0,
      take: 25,

      select: {
        courseId: true,
        title: true,
        description: true,
        level: true,
        type: true,
        visibility: true,
        status: true,
        instructorId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    expect(count).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  });

  it('uses createdAt descending order by default', async () => {
    resetMocks();

    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await query.search({
      page: 1,
      limit: 20,
      sortOrder: 'desc',
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          {
            createdAt: 'desc',
          },
          {
            courseId: 'desc',
          },
        ],
      }),
    );
  });

  it('uses ascending deterministic ordering when requested', async () => {
    resetMocks();

    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await query.search({
      page: 1,
      limit: 20,
      sortBy: 'title',
      sortOrder: 'asc',
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          {
            title: 'asc',
          },
          {
            courseId: 'asc',
          },
        ],
      }),
    );
  });

  it('supports every declared sort field', async () => {
    resetMocks();

    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    const sortFields = [
      'title',
      'status',
      'level',
      'type',
      'visibility',
      'createdAt',
      'updatedAt',
    ] as const;

    for (const sortBy of sortFields) {
      await query.search({
        page: 1,
        limit: 20,
        sortBy,
        sortOrder: 'asc',
      });
    }

    expect(findMany).toHaveBeenCalledTimes(sortFields.length);

    for (const [index, sortBy] of sortFields.entries()) {
      expect(findMany.mock.calls[index]?.[0]).toEqual(
        expect.objectContaining({
          orderBy: [
            {
              [sortBy]: 'asc',
            },
            {
              courseId: 'asc',
            },
          ],
        }),
      );
    }
  });

  it('calculates pagination offsets correctly', async () => {
    resetMocks();

    findMany.mockResolvedValue([]);
    count.mockResolvedValue(45);

    const result = await query.search({
      page: 3,
      limit: 10,
      sortOrder: 'desc',
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 10,
      }),
    );

    expect(result.meta).toEqual({
      page: 3,
      limit: 10,
      total: 45,
      totalPages: 5,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it('returns zero total pages for an empty result set', async () => {
    resetMocks();

    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    const result = await query.search({
      page: 1,
      limit: 20,
      sortOrder: 'desc',
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

  it('uses the same filters for page retrieval and total count', async () => {
    resetMocks();

    findMany.mockResolvedValue([]);
    count.mockResolvedValue(7);

    await query.search({
      status: 'PUBLISHED',
      instructorId: 'instructor-001',
      page: 1,
      limit: 20,
      sortOrder: 'desc',
    });

    const findManyWhere = findMany.mock.calls[0]?.[0]?.where;

    const countWhere = count.mock.calls[0]?.[0]?.where;

    expect(findManyWhere).toEqual({
      status: 'PUBLISHED',
      instructorId: 'instructor-001',
    });

    expect(countWhere).toEqual(findManyWhere);
  });

  it('does not hydrate ownership, versions, or transactional aggregate state', async () => {
    resetMocks();

    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await query.search({
      page: 1,
      limit: 20,
      sortOrder: 'desc',
    });

    const args = findMany.mock.calls[0]?.[0];

    expect(args).not.toHaveProperty('include');

    expect(args?.select).not.toHaveProperty('ownershipAssignments');
    expect(args?.select).not.toHaveProperty('versions');
    expect(args?.select).not.toHaveProperty('course');
  });

  it('does not expose read-model infrastructure through the result', async () => {
    resetMocks();

    findMany.mockResolvedValue([
      {
        courseId: 'course-001',
        title: 'Physics',
        description: 'Physics course',
        level: 'BEGINNER',
        type: 'SELF_PACED',
        visibility: 'PUBLIC',
        status: 'PUBLISHED',
        instructorId: 'instructor-001',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      },
    ]);

    count.mockResolvedValue(1);

    const result = await query.search({
      page: 1,
      limit: 20,
      sortOrder: 'desc',
    });

    expect(result.items[0]).toEqual({
      id: 'course-001',
      title: 'Physics',
      description: 'Physics course',
      level: 'BEGINNER',
      type: 'SELF_PACED',
      visibility: 'PUBLIC',
      status: 'PUBLISHED',
      instructorId: 'instructor-001',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });

    expect(result.items[0]).not.toHaveProperty('courseId');
    expect(result.items[0]).not.toHaveProperty('projectionSchemaVersion');
  });

  it('translates Prisma failures through the repository error boundary', async () => {
    resetMocks();

    findMany.mockRejectedValue({
      code: 'P2002',
      message: 'Unique constraint failed',
    });

    await expect(
      query.search({
        page: 1,
        limit: 20,
        sortOrder: 'desc',
      }),
    ).rejects.toMatchObject({
      code: expect.anything(),
    });
  });
});