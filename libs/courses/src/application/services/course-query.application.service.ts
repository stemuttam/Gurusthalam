import {
  courseQueryInputSchema,
  type CourseQuery,
  type CourseQueryRequest,
  type CourseQueryResultPage,
} from '../contracts/index.js';

/**
 * Application service for Course read/query scenarios.
 *
 * Responsibilities:
 * - validate the application query contract;
 * - normalize optional query properties at the application boundary;
 * - delegate read execution to CourseQuery;
 * - keep query orchestration independent from persistence;
 * - return read-side projections rather than Course aggregates.
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
   * Executes a validated Course discovery/read query.
   *
   * The validation schema is intentionally shared with Course search.
   *
   * The normalized object is constructed explicitly instead of forwarding
   * the schema output directly. This is required because the repository
   * uses exactOptionalPropertyTypes: optional properties must be omitted
   * rather than explicitly supplied as `undefined`.
   */
  async search(
    request: CourseQueryRequest,
  ): Promise<CourseQueryResultPage> {
    const validatedRequest = courseQueryInputSchema.parse(request);

    const normalizedRequest: CourseQueryRequest = {
      page: validatedRequest.page,
      limit: validatedRequest.limit,
      sortOrder: validatedRequest.sortOrder,

      ...(validatedRequest.sortBy !== undefined
        ? {
            sortBy: validatedRequest.sortBy,
          }
        : {}),

      ...(validatedRequest.query !== undefined
        ? {
            query: validatedRequest.query,
          }
        : {}),

      ...(validatedRequest.status !== undefined
        ? {
            status: validatedRequest.status,
          }
        : {}),

      ...(validatedRequest.visibility !== undefined
        ? {
            visibility: validatedRequest.visibility,
          }
        : {}),

      ...(validatedRequest.level !== undefined
        ? {
            level: validatedRequest.level,
          }
        : {}),

      ...(validatedRequest.type !== undefined
        ? {
            type: validatedRequest.type,
          }
        : {}),

      ...(validatedRequest.instructorId !== undefined
        ? {
            instructorId: validatedRequest.instructorId,
          }
        : {}),
    };

    return this.courseQuery.search(normalizedRequest);
  }
}