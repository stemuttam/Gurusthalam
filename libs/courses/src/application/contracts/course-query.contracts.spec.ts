import { describe, expect, it } from 'vitest';

import type {
  CourseQuery,
  CourseQueryRequest,
  CourseQueryResult,
  CourseQueryResultPage,
} from './course-query.contracts.js';

describe('CourseQuery contract', () => {
  it('accepts an implementation matching the query contract', async () => {
    const repository: CourseQuery = {
      async search(
        request: CourseQueryRequest,
      ): Promise<CourseQueryResultPage> {
        expect(request).toBeDefined();

        return {
          items: [],
          meta: {
            page: request.page,
            limit: request.limit,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        };
      },
    };

    const request: CourseQueryRequest = {
      page: 1,
      limit: 20,
      sortOrder: 'desc',
    };

    const result = await repository.search(request);

    expect(result).toEqual({
      items: [],
      meta: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });

    expect(repository.search).toBeTypeOf('function');
  });

  it('represents query results as read-side projections', () => {
    const result: CourseQueryResult = {
      id: 'course-123',
      title: 'Physics Fundamentals',
      description: 'Introduction to physics.',
      level: 'BEGINNER',
      type: 'SELF_PACED',
      visibility: 'PUBLIC',
      status: 'PUBLISHED',
      instructorId: 'instructor-123',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };

    expect(result.id).toBe('course-123');
    expect(result.title).toBe('Physics Fundamentals');
    expect(result.instructorId).toBe('instructor-123');
  });

  it('supports populated paginated query results', async () => {
    const query: CourseQuery = {
      async search(
        request: CourseQueryRequest,
      ): Promise<CourseQueryResultPage> {
        return {
          items: [
            {
              id: 'course-123',
              title: 'Physics Fundamentals',
              description: 'Introduction to physics.',
              level: 'BEGINNER',
              type: 'SELF_PACED',
              visibility: 'PUBLIC',
              status: 'PUBLISHED',
              instructorId: 'instructor-123',
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
              updatedAt: new Date('2026-01-02T00:00:00.000Z'),
            },
          ],
          meta: {
            page: request.page,
            limit: request.limit,
            total: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        };
      },
    };

    const result = await query.search({
      page: 1,
      limit: 20,
      sortOrder: 'desc',
    });

    expect(result.items).toHaveLength(1);
    expect(result.meta.total).toBe(1);
    expect(result.meta.totalPages).toBe(1);
  });
});
