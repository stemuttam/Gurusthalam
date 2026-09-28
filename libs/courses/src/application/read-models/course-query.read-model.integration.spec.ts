import { describe, expect, it, vi } from 'vitest';

import type {
  CourseQueryResultPage,
  CourseQueryRequest,
} from '../contracts/course-query.contracts.js';

import { DefaultCourseQueryApplicationService } from '../services/course-query.application.service.js';

import type { CourseCatalogProjectionQuery } from './course-catalog.query.js';

describe('Course query read-model integration', () => {
  const createProjectionQuery = (): CourseCatalogProjectionQuery => ({
    search: vi.fn(),
  });

  it('allows the Course query application boundary to consume a CourseCatalog projection query', async () => {
    const projectionQuery = createProjectionQuery();

    const expected: CourseQueryResultPage = {
      items: [
        {
          id: 'course-001',
          title: 'Introduction to Physics',
          description: 'Mechanics and motion.',
          level: 'BEGINNER',
          type: 'SELF_PACED',
          visibility: 'PUBLIC',
          status: 'PUBLISHED',
          instructorId: 'instructor-001',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        },
      ],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };

    vi.mocked(projectionQuery.search).mockResolvedValue(expected);

    const application = new DefaultCourseQueryApplicationService(
      projectionQuery,
    );

    const request: CourseQueryRequest = {
      page: 1,
      limit: 20,
      sortOrder: 'desc',
      sortBy: 'updatedAt',
      query: 'physics',
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      level: 'BEGINNER',
      type: 'SELF_PACED',
      instructorId: 'instructor-001',
    };

    const result = await application.search(request);

    expect(projectionQuery.search).toHaveBeenCalledTimes(1);
    expect(projectionQuery.search).toHaveBeenCalledWith(request);
    expect(result).toBe(expected);
  });

  it('preserves the existing application query boundary without exposing persistence details', async () => {
    const projectionQuery = createProjectionQuery();

    const expected: CourseQueryResultPage = {
      items: [],
      meta: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };

    vi.mocked(projectionQuery.search).mockResolvedValue(expected);

    const application = new DefaultCourseQueryApplicationService(
      projectionQuery,
    );

    const request: CourseQueryRequest = {
      page: 1,
      limit: 20,
      sortOrder: 'asc',
    };

    const result = await application.search(request);

    expect(result).toBe(expected);

    expect(projectionQuery).not.toHaveProperty('prisma');
    expect(projectionQuery).not.toHaveProperty('sql');
    expect(projectionQuery).not.toHaveProperty('embedding');
    expect(projectionQuery).not.toHaveProperty('vectorId');
    expect(projectionQuery).not.toHaveProperty('modelId');
    expect(projectionQuery).not.toHaveProperty('agentState');
  });

  it('keeps the query application boundary independent from Course aggregate mutation', async () => {
    const projectionQuery = createProjectionQuery();

    const expected: CourseQueryResultPage = {
      items: [],
      meta: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };

    vi.mocked(projectionQuery.search).mockResolvedValue(expected);

    const application = new DefaultCourseQueryApplicationService(
      projectionQuery,
    );

    await application.search({
      page: 1,
      limit: 20,
      sortOrder: 'desc',
    });

    expect(projectionQuery.search).toHaveBeenCalledTimes(1);
  });
});
