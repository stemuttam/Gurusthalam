import { describe, expect, it, vi } from 'vitest';

import type {
  CourseQuery,
  CourseQueryResultPage,
} from '../contracts/index.js';

import { CourseValidationError } from '../../domain/errors/course-validation.error.js';

import { DefaultCourseQueryApplicationService } from './course-query.application.service.js';

const createCourseQueryMock = (): CourseQuery => ({
  search: vi.fn(),
});

describe('DefaultCourseQueryApplicationService', () => {
  it('applies pagination defaults before delegating to CourseQuery', async () => {
    const courseQuery = createCourseQueryMock();

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

    vi.mocked(courseQuery.search).mockResolvedValue(expected);

    const service =
      new DefaultCourseQueryApplicationService(courseQuery);

    const result = await service.search({});

    expect(courseQuery.search).toHaveBeenCalledTimes(1);

    expect(courseQuery.search).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      sortOrder: 'desc',
    });

    expect(result).toBe(expected);
  });

  it('coerces HTTP pagination strings into application numbers', async () => {
    const courseQuery = createCourseQueryMock();

    const expected: CourseQueryResultPage = {
      items: [],
      meta: {
        page: 3,
        limit: 50,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: true,
      },
    };

    vi.mocked(courseQuery.search).mockResolvedValue(expected);

    const service =
      new DefaultCourseQueryApplicationService(courseQuery);

    const result = await service.search({
      page: '3',
      limit: '50',
      sortOrder: 'asc',
    });

    expect(courseQuery.search).toHaveBeenCalledWith({
      page: 3,
      limit: 50,
      sortOrder: 'asc',
    });

    expect(result).toBe(expected);
  });

  it('normalizes a complete query request', async () => {
    const courseQuery = createCourseQueryMock();

    const expected: CourseQueryResultPage = {
      items: [],
      meta: {
        page: 2,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: true,
      },
    };

    vi.mocked(courseQuery.search).mockResolvedValue(expected);

    const service =
      new DefaultCourseQueryApplicationService(courseQuery);

    await service.search({
      page: '2',
      limit: '10',
      sortOrder: 'asc',
      sortBy: 'title',
      query: ' physics ',
      status: 'DRAFT',
      visibility: 'PRIVATE',
      level: 'BEGINNER',
      type: 'SELF_PACED',
      instructorId: ' instructor-001 ',
    });

    expect(courseQuery.search).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      sortOrder: 'asc',
      sortBy: 'title',
      query: 'physics',
      status: 'DRAFT',
      visibility: 'PRIVATE',
      level: 'BEGINNER',
      type: 'SELF_PACED',
      instructorId: 'instructor-001',
    });
  });

  it('rejects invalid pagination values with CourseValidationError', async () => {
    const courseQuery = createCourseQueryMock();

    const service =
      new DefaultCourseQueryApplicationService(courseQuery);

    await expect(
      service.search({
        page: 'not-a-number',
      }),
    ).rejects.toBeInstanceOf(CourseValidationError);

    expect(courseQuery.search).not.toHaveBeenCalled();
  });

  it('rejects invalid enum values with CourseValidationError', async () => {
    const courseQuery = createCourseQueryMock();

    const service =
      new DefaultCourseQueryApplicationService(courseQuery);

    await expect(
      service.search({
        status: 'INVALID_STATUS' as never,
      }),
    ).rejects.toBeInstanceOf(CourseValidationError);

    expect(courseQuery.search).not.toHaveBeenCalled();
  });

  it('rejects unsupported sort fields with CourseValidationError', async () => {
    const courseQuery = createCourseQueryMock();

    const service =
      new DefaultCourseQueryApplicationService(courseQuery);

    await expect(
      service.search({
        sortBy: 'unsupported-field' as never,
      }),
    ).rejects.toBeInstanceOf(CourseValidationError);

    expect(courseQuery.search).not.toHaveBeenCalled();
  });

  it('rejects unexpected fields with CourseValidationError', async () => {
    const courseQuery = createCourseQueryMock();

    const service =
      new DefaultCourseQueryApplicationService(courseQuery);

    await expect(
      service.search({
        unexpectedField: 'value',
      } as never),
    ).rejects.toBeInstanceOf(CourseValidationError);

    expect(courseQuery.search).not.toHaveBeenCalled();
  });

  it('exposes structured validation issues', async () => {
    const courseQuery = createCourseQueryMock();

    const service =
      new DefaultCourseQueryApplicationService(courseQuery);

    try {
      await service.search({
        page: 'invalid',
      });

      throw new Error(
        'Expected CourseValidationError to be thrown.',
      );
    } catch (error) {
      expect(error).toBeInstanceOf(CourseValidationError);

      const validationError =
        error as CourseValidationError;

      expect(validationError.issues.length).toBeGreaterThan(0);

      expect(validationError.issues[0]?.field).toBe('page');
    }
  });

  it('does not mutate the caller input', async () => {
    const courseQuery = createCourseQueryMock();

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

    vi.mocked(courseQuery.search).mockResolvedValue(expected);

    const service =
      new DefaultCourseQueryApplicationService(courseQuery);

    const request = {
      query: ' physics ',
      page: '1',
      limit: '20',
    };

    await service.search(request);

    expect(request).toEqual({
      query: ' physics ',
      page: '1',
      limit: '20',
    });
  });
});