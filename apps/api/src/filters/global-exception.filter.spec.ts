import { HttpException, HttpStatus } from '@nestjs/common';

import { describe, expect, it, vi } from 'vitest';

import {
  CourseDomainErrorCode,
  CourseValidationError,
  InvalidCourseStateTransitionError,
} from '@gurusthalam/courses';

import type { GurusthalamLogger } from '@gurusthalam/logger';

import { GlobalExceptionFilter } from './global-exception.filter.js';

describe('GlobalExceptionFilter', () => {
  const createLogger = (): {
    logger: GurusthalamLogger;
    error: ReturnType<typeof vi.fn>;
  } => {
    const error = vi.fn();

    return {
      logger: {
        error,
      } as unknown as GurusthalamLogger,
      error,
    };
  };

  const createHttpContext = (): {
    host: {
      switchToHttp: () => {
        getRequest: () => {
          method: string;
          originalUrl: string;
          url: string;
        };
        getResponse: () => {
          locals: {
            requestId?: string;
          };
          status: ReturnType<typeof vi.fn>;
          json: ReturnType<typeof vi.fn>;
        };
      };
    };
    response: {
      locals: {
        requestId?: string;
      };
      status: ReturnType<typeof vi.fn>;
      json: ReturnType<typeof vi.fn>;
    };
  } => {
    const response = {
      locals: {
        requestId: 'request-123',
      },
      status: vi.fn(),
      json: vi.fn(),
    };

    response.status.mockReturnValue(response);

    const request = {
      method: 'POST',
      originalUrl: '/api/courses/course-123/publish',
      url: '/courses/course-123/publish',
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

  describe('CourseValidationError', () => {
    it('maps CourseValidationError to HTTP 400 and preserves structured issues', () => {
      const { logger, error } = createLogger();
      const { host, response } = createHttpContext();

      const exception = new CourseValidationError('Course validation failed.', [
        {
          field: 'title',
          message: 'Course title is required.',
        },
        {
          field: 'level',
          message: 'Course level is invalid.',
        },
      ]);

      const filter = new GlobalExceptionFilter(logger);

      filter.catch(exception, host as never);

      expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          path: '/api/courses/course-123/publish',
          requestId: 'request-123',
          message: 'Course validation failed.',
          code: CourseDomainErrorCode.VALIDATION_ERROR,
          issues: [
            {
              field: 'title',
              message: 'Course title is required.',
            },
            {
              field: 'level',
              message: 'Course level is invalid.',
            },
          ],
        }),
      );

      expect(error).toHaveBeenCalledTimes(1);

      expect(error).toHaveBeenCalledWith(
        'Unhandled HTTP exception',
        exception,
        {
          requestId: 'request-123',
          operation: 'POST /api/courses/course-123/publish',
        },
      );
    });

    it('maps an empty CourseValidationError to HTTP 400', () => {
      const { logger } = createLogger();
      const { host, response } = createHttpContext();

      const exception = new CourseValidationError('Course validation failed.');

      const filter = new GlobalExceptionFilter(logger);

      filter.catch(exception, host as never);

      expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Course validation failed.',
          code: CourseDomainErrorCode.VALIDATION_ERROR,
          issues: [],
        }),
      );
    });
  });

  describe('InvalidCourseStateTransitionError', () => {
    it('maps invalid lifecycle transitions to HTTP 409 and preserves transition details', () => {
      const { logger } = createLogger();
      const { host, response } = createHttpContext();

      const exception = new InvalidCourseStateTransitionError(
        'PUBLISHED',
        'DRAFT',
      );

      const filter = new GlobalExceptionFilter(logger);

      filter.catch(exception, host as never);

      expect(response.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.CONFLICT,
          message:
            'Invalid Course status transition from "PUBLISHED" to "DRAFT".',
          code: CourseDomainErrorCode.INVALID_STATE_TRANSITION,
          transition: {
            from: 'PUBLISHED',
            to: 'DRAFT',
          },
        }),
      );
    });
  });

  describe('Nest HttpException compatibility', () => {
    it('preserves an existing Nest HTTP exception status and message', () => {
      const { logger } = createLogger();
      const { host, response } = createHttpContext();

      const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

      const filter = new GlobalExceptionFilter(logger);

      filter.catch(exception, host as never);

      expect(response.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.FORBIDDEN,
          message: 'Forbidden',
        }),
      );
    });

    it('preserves structured Nest HTTP exception messages', () => {
      const { logger } = createLogger();
      const { host, response } = createHttpContext();

      const exception = new HttpException(
        {
          message: [
            'title must be longer than 1 character',
            'level must be a valid course level',
          ],
          error: 'Bad Request',
        },
        HttpStatus.BAD_REQUEST,
      );

      const filter = new GlobalExceptionFilter(logger);

      filter.catch(exception, host as never);

      expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          message: [
            'title must be longer than 1 character',
            'level must be a valid course level',
          ],
        }),
      );
    });
  });

  describe('unknown errors', () => {
    it('maps an ordinary Error to HTTP 500 without exposing its message', () => {
      const { logger } = createLogger();
      const { host, response } = createHttpContext();

      const exception = new Error('Database connection details must not leak.');

      const filter = new GlobalExceptionFilter(logger);

      filter.catch(exception, host as never);

      expect(response.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
        }),
      );

      expect(response.json).not.toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Database connection details must not leak.',
        }),
      );
    });

    it('maps a non-Error thrown value to HTTP 500', () => {
      const { logger } = createLogger();
      const { host, response } = createHttpContext();

      const filter = new GlobalExceptionFilter(logger);

      filter.catch('unexpected failure', host as never);

      expect(response.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
        }),
      );
    });
  });

  describe('response metadata', () => {
    it('includes an ISO timestamp and request path', () => {
      const { logger } = createLogger();
      const { host, response } = createHttpContext();

      const filter = new GlobalExceptionFilter(logger);

      filter.catch(new CourseValidationError('Invalid Course.'), host as never);

      const payload = response.json.mock.calls[0]?.[0] as {
        readonly timestamp: string;
        readonly path: string;
      };

      expect(payload.timestamp).toEqual(expect.any(String));

      expect(Number.isNaN(Date.parse(payload.timestamp))).toBe(false);

      expect(payload.path).toBe('/api/courses/course-123/publish');
    });

    it('omits requestId when it is not available', () => {
      const { logger } = createLogger();
      const { host, response } = createHttpContext();

      delete response.locals.requestId;

      const filter = new GlobalExceptionFilter(logger);

      filter.catch(new CourseValidationError('Invalid Course.'), host as never);

      const payload = response.json.mock.calls[0]?.[0] as Record<
        string,
        unknown
      >;

      expect(payload).not.toHaveProperty('requestId');
    });
  });
});
