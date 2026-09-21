import { describe, expect, it, vi } from 'vitest';

import type { PrismaClient } from '@gurusthalam/database';

import { PrismaCourseQuery } from './prisma-course.query.js';

describe('PrismaCourseQuery', () => {
  const findMany = vi.fn();

  const count = vi.fn();

  const prisma = {
    course: {
      findMany,
      count,
    },
  } as unknown as PrismaClient;

  const query = new PrismaCourseQuery(prisma);

  const resetMocks = (): void => {
    findMany.mockReset();
    count.mockReset();
  };

  it('returns paginated Course projections', async () => {
    resetMocks();

    findMany.mockResolvedValue([
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

    expect(findMany).toHaveBeenCalledWith({
      where: {
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
      },

      orderBy: [
        {
          createdAt: 'desc',
        },
        {
          id: 'desc',
        },
      ],

      skip: 0,
      take: 20,

      select: {
        id: true,
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
      where: {
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
      },
    });
  });

  it('applies all supported structured filters', async () => {
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
          id: 'asc',
        },
      ],

      skip: 0,
      take: 25,

      select: {
        id: true,
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
            id: 'desc',
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
            id: 'asc',
          },
        ],
      }),
    );
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

  it('does not load ownership assignments or related aggregate state', async () => {
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
  });

  it('uses the same filter for the page query and total count', async () => {
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
