import { HttpStatus } from '@nestjs/common';

import { describe, expect, it, vi } from 'vitest';

import {
  CourseValidationError,
  DefaultCourseQueryApplicationService,
} from '@gurusthalam/courses';

import type { CourseQuery } from '@gurusthalam/courses';

import type { GurusthalamLogger } from '@gurusthalam/logger';

import { GlobalExceptionFilter } from './global-exception.filter.js';

describe('Course validation error cross-layer contract', () => {
  const createLogger = (): {
    readonly logger: GurusthalamLogger;
    readonly error: ReturnType<typeof vi.fn>;
  } => {
    const error = vi.fn();

    return {
      logger: {
        error,
      } as unknown as GurusthalamLogger,
      error,
    };
  };

  const createHttpHost = () => {
    const response = {
      locals: {
        requestId: 'validation-request-001',
      },
      status: vi.fn(),
      json: vi.fn(),
    };

    response.status.mockReturnValue(response);

    const request = {
      method: 'GET',
      originalUrl: '/courses?page=invalid',
      url: '/courses?page=invalid',
    };

    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    };

    return {
      host,
      response,
    };
  };

  it('propagates malformed query input through the CourseValidationError contract into HTTP 400', async () => {
    const courseQuery: CourseQuery = {
      search: vi.fn(),
    };

    const service = new DefaultCourseQueryApplicationService(courseQuery);

    let caughtError: unknown;

    try {
      await service.search({
        page: 'invalid',
      });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(CourseValidationError);

    const { logger, error: loggerError } = createLogger();

    const { host, response } = createHttpHost();

    const filter = new GlobalExceptionFilter(logger);

    filter.catch(caughtError, host as never);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        requestId: 'validation-request-001',
        message: 'Invalid Course query parameters.',
        code: 'COURSE_VALIDATION_ERROR',
        issues: expect.arrayContaining([
          expect.objectContaining({
            field: 'page',
          }),
        ]),
      }),
    );

    expect(loggerError).toHaveBeenCalledTimes(1);

    expect(courseQuery.search).not.toHaveBeenCalled();
  });

  it('does not expose the underlying ZodError cause through the HTTP response', async () => {
    const courseQuery: CourseQuery = {
      search: vi.fn(),
    };

    const service = new DefaultCourseQueryApplicationService(courseQuery);

    let caughtError: unknown;

    try {
      await service.search({
        page: 'invalid',
      });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(CourseValidationError);

    const { logger } = createLogger();

    const { host, response } = createHttpHost();

    const filter = new GlobalExceptionFilter(logger);

    filter.catch(caughtError, host as never);

    const payload = response.json.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(payload).not.toHaveProperty('cause');

    expect(payload).not.toHaveProperty('stack');
  });
});
