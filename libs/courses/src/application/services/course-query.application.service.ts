import { ZodError } from 'zod';

import {
  courseQueryInputSchema,
  type CourseQuery,
  type CourseQueryInputSchema,
  type CourseQueryRequest,
  type CourseQueryResultPage,
  type CourseQueryValidatedSchema,
} from '../contracts/index.js';

import { CourseValidationError } from '../../domain/errors/course-validation.error.js';

/**
 * Application service for Course read/query scenarios.
 *
 * Responsibilities:
 * - accept raw application-bound query input;
 * - validate the query contract;
 * - coerce HTTP-compatible pagination values;
 * - apply pagination defaults;
 * - validate enum/filter/sort values;
 * - normalize optional properties;
 * - delegate read execution to CourseQuery;
 * - return read-side projections.
 *
 * Deliberately excluded:
 * - Prisma;
 * - SQL;
 * - HTTP/NestJS;
 * - authorization;
 * - authentication;
 * - aggregate mutation;
 * - domain-event publication;
 * - read-model persistence implementation.
 */
export class DefaultCourseQueryApplicationService {
  constructor(
    private readonly courseQuery: CourseQuery,
  ) {}

  /**
   * Executes a Course discovery/read query.
   *
   * Raw values are deliberately accepted here because this is the
   * application validation boundary.
   *
   * Example:
   *
   *   page = "2"
   *
   * becomes:
   *
   *   page = 2
   *
   * after Zod parsing.
   */
  async search(
    request: CourseQueryInputSchema,
  ): Promise<CourseQueryResultPage> {
    let validatedRequest: CourseQueryValidatedSchema;

    try {
      validatedRequest = courseQueryInputSchema.parse(request);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new CourseValidationError(
          'Invalid Course query parameters.',
          error.issues.map((issue) => ({
            field:
              issue.path.length > 0
                ? issue.path.join('.')
                : 'query',
            message: issue.message,
          })),
          {
            cause: error,
          },
        );
      }

      throw error;
    }

    const normalizedRequest =
      this.toCourseQueryRequest(validatedRequest);

    return this.courseQuery.search(normalizedRequest);
  }

  /**
   * Converts the validated Zod output into the strict application
   * CourseQueryRequest contract.
   *
   * This method deliberately omits optional properties when they are
   * absent instead of assigning `undefined`.
   *
   * That is required by exactOptionalPropertyTypes.
   */
  private toCourseQueryRequest(
    validatedRequest: CourseQueryValidatedSchema,
  ): CourseQueryRequest {
    const normalizedRequest = {
      page: validatedRequest.page,
      limit: validatedRequest.limit,
      sortOrder: validatedRequest.sortOrder,
    } as CourseQueryRequest;

    if (validatedRequest.sortBy !== undefined) {
      Object.assign(normalizedRequest, {
        sortBy: validatedRequest.sortBy,
      });
    }

    if (validatedRequest.query !== undefined) {
      Object.assign(normalizedRequest, {
        query: validatedRequest.query,
      });
    }

    if (validatedRequest.status !== undefined) {
      Object.assign(normalizedRequest, {
        status: validatedRequest.status,
      });
    }

    if (validatedRequest.visibility !== undefined) {
      Object.assign(normalizedRequest, {
        visibility: validatedRequest.visibility,
      });
    }

    if (validatedRequest.level !== undefined) {
      Object.assign(normalizedRequest, {
        level: validatedRequest.level,
      });
    }

    if (validatedRequest.type !== undefined) {
      Object.assign(normalizedRequest, {
        type: validatedRequest.type,
      });
    }

    if (validatedRequest.instructorId !== undefined) {
      Object.assign(normalizedRequest, {
        instructorId: validatedRequest.instructorId,
      });
    }

    return normalizedRequest;
  }
}