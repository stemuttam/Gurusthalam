import type {
  CourseQuery,
  CourseQueryRequest,
  CourseQueryResult,
  CourseQueryResultPage,
} from '@gurusthalam/courses';

import type { PrismaClient } from '@gurusthalam/database';

import { withPrismaRepositoryErrorBoundary } from '../prisma-repository-error.mapper.js';

type CourseQuerySortField = NonNullable<CourseQueryRequest['sortBy']>;

const DEFAULT_SORT_FIELD: CourseQuerySortField = 'createdAt';

const DEFAULT_SORT_ORDER: NonNullable<CourseQueryRequest['sortOrder']> = 'desc';

/**
 * Prisma-backed implementation of the CourseQuery read boundary.
 *
 * This adapter deliberately does not use CourseRepository because
 * query scenarios must return read-side projections rather than
 * rehydrated Course aggregates.
 *
 * The implementation:
 * - queries the Course table directly;
 * - does not load ownership assignments;
 * - does not create Course domain objects;
 * - applies application-level filters;
 * - applies deterministic pagination;
 * - returns a CourseQueryResult projection.
 */
export class PrismaCourseQuery implements CourseQuery {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Executes a paginated Course query.
   *
   * Filtering, ordering, counting, and projection are performed
   * directly against the persistence model.
   */
  async search(request: CourseQueryRequest): Promise<CourseQueryResultPage> {
    return withPrismaRepositoryErrorBoundary('CourseQuery.search', async () => {
      const where = PrismaCourseQuery.buildWhere(request);

      const sortBy = request.sortBy ?? DEFAULT_SORT_FIELD;

      const sortOrder = request.sortOrder ?? DEFAULT_SORT_ORDER;

      const skip = (request.page - 1) * request.limit;

      const [records, total] = await Promise.all([
        this.prisma.course.findMany({
          where,
          orderBy: [
            {
              [sortBy]: sortOrder,
            },
            {
              id: sortOrder,
            },
          ],
          skip,
          take: request.limit,
          select: PrismaCourseQuery.selectProjection,
        }),

        this.prisma.course.count({
          where,
        }),
      ]);

      return {
        items: records.map((record) => PrismaCourseQuery.toQueryResult(record)),

        meta: PrismaCourseQuery.createPaginationMeta(
          request.page,
          request.limit,
          total,
        ),
      };
    });
  }

  /**
   * Builds the Prisma Course filter from the
   * infrastructure-agnostic application request.
   *
   * The query vocabulary remains owned by the
   * Course application contract; Prisma expressions
   * remain confined to this adapter.
   */
  private static buildWhere(request: CourseQueryRequest) {
    return {
      ...(request.query !== undefined
        ? {
            OR: [
              {
                title: {
                  contains: request.query,
                  mode: 'insensitive' as const,
                },
              },
              {
                description: {
                  contains: request.query,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),

      ...(request.status !== undefined
        ? {
            status: request.status,
          }
        : {}),

      ...(request.visibility !== undefined
        ? {
            visibility: request.visibility,
          }
        : {}),

      ...(request.level !== undefined
        ? {
            level: request.level,
          }
        : {}),

      ...(request.type !== undefined
        ? {
            type: request.type,
          }
        : {}),

      ...(request.instructorId !== undefined
        ? {
            instructorId: request.instructorId,
          }
        : {}),
    };
  }

  /**
   * Explicitly restricts the read projection to fields
   * represented by CourseQueryResult.
   *
   * Ownership, versions, and all unrelated persistence
   * state remain excluded.
   */
  private static readonly selectProjection = {
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
  } as const;

  /**
   * Converts the persistence projection into the
   * infrastructure-agnostic query projection.
   */
  private static toQueryResult(record: {
    readonly id: string;
    readonly title: string;
    readonly description: string | null;
    readonly level: string;
    readonly type: string;
    readonly visibility: string;
    readonly status: string;
    readonly instructorId: string;
    readonly createdAt: Date;
    readonly updatedAt: Date;
  }): CourseQueryResult {
    return {
      id: record.id,
      title: record.title,
      description: record.description,
      level: record.level,
      type: record.type,
      visibility: record.visibility,
      status: record.status,
      instructorId: record.instructorId,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    };
  }

  /**
   * Creates deterministic pagination metadata.
   *
   * An empty result set has zero total pages.
   */
  private static createPaginationMeta(
    page: number,
    limit: number,
    total: number,
  ) {
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1 && totalPages > 0,
    };
  }
}
