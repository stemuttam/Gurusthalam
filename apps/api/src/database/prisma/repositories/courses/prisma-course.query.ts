import type {
  CourseCatalogProjectionQuery,
  CourseQueryRequest,
  CourseQueryResult,
  CourseQueryResultPage,
} from '@gurusthalam/courses';

import type { PrismaClient } from '@gurusthalam/database';

import { withPrismaRepositoryErrorBoundary } from '../prisma-repository-error.mapper.js';

type CourseQuerySortField = NonNullable<CourseQueryRequest['sortBy']>;
type CourseQuerySortOrder = NonNullable<CourseQueryRequest['sortOrder']>;

const DEFAULT_SORT_FIELD: CourseQuerySortField = 'createdAt';

const DEFAULT_SORT_ORDER: CourseQuerySortOrder = 'desc';

/**
 * Prisma-backed implementation of the infrastructure-neutral CourseQuery
 * read-model boundary.
 *
 * 4.14-H — Pagination / Filtering / Sorting
 * -------------------------------------------
 *
 * The query path intentionally reads from CourseCatalogProjection rather
 * than the transactional Course aggregate table.
 *
 * Architectural flow:
 *
 *   Course aggregate
 *        ↓
 *   Course domain events
 *        ↓
 *   CourseProjectionEventHandler
 *        ↓
 *   CourseCatalogProjection
 *        ↓
 *   PrismaCourseQuery
 *        ↓
 *   CourseQuery
 *        ↓
 *   DefaultCourseQueryApplicationService
 *        ↓
 *   CourseController
 *
 * This preserves the read/write separation established by 4.14-G:
 *
 * - Course remains the transactional source of truth;
 * - CourseCatalogProjection is derived read-side state;
 * - query operations never hydrate Course aggregates;
 * - query operations never mutate transactional Course state;
 * - projection persistence remains independently rebuildable;
 * - pagination/filtering/sorting execute against the read model;
 * - the application contract remains infrastructure-neutral.
 *
 * The implementation deliberately does not expose:
 *
 * - Prisma types outside this infrastructure adapter;
 * - SQL;
 * - database operators;
 * - aggregate mutation;
 * - ownership hydration;
 * - CourseVersion hydration;
 * - domain-event publication;
 * - authorization;
 * - authentication;
 * - search-engine APIs;
 * - vector storage;
 * - embeddings;
 * - ranking models.
 */
export class PrismaCourseQuery implements CourseCatalogProjectionQuery {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Executes a deterministic paginated query against the canonical
   * CourseCatalog read model.
   *
   * Pagination, filtering, ordering, projection, and counting are all
   * executed directly against CourseCatalogProjection.
   *
   * The total count intentionally uses the exact same filter object as the
   * page query so pagination metadata cannot describe a different dataset.
   */
  async search(request: CourseQueryRequest): Promise<CourseQueryResultPage> {
    return withPrismaRepositoryErrorBoundary(
      'CourseQuery.search',
      async () => {
        const where = PrismaCourseQuery.buildWhere(request);

        const sortBy = request.sortBy ?? DEFAULT_SORT_FIELD;

        const sortOrder = request.sortOrder ?? DEFAULT_SORT_ORDER;

        const skip = (request.page - 1) * request.limit;

        const [records, total] = await Promise.all([
          this.prisma.courseCatalogProjection.findMany({
            where,
            orderBy: [
              {
                [sortBy]: sortOrder,
              },
              {
                courseId: sortOrder,
              },
            ],
            skip,
            take: request.limit,
            select: PrismaCourseQuery.selectProjection,
          }),

          this.prisma.courseCatalogProjection.count({
            where,
          }),
        ]);

        return {
          items: records.map((record) =>
            PrismaCourseQuery.toQueryResult(record),
          ),

          meta: PrismaCourseQuery.createPaginationMeta(
            request.page,
            request.limit,
            total,
          ),
        };
      },
    );
  }

  /**
   * Converts the infrastructure-neutral Course query vocabulary into
   * Prisma's CourseCatalogProjection filtering expression.
   *
   * The application contract remains the authority for which filters are
   * supported. Prisma-specific expressions remain confined to this adapter.
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
   * Explicitly restricts the query projection to the infrastructure-neutral
   * CourseQueryResult shape.
   *
   * This prevents accidental hydration of future read-model fields and
   * guarantees that query consumers cannot accidentally depend on unrelated
   * projection state.
   */
  private static readonly selectProjection = {
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
  } as const;

  /**
   * Converts a CourseCatalogProjection persistence record into the
   * infrastructure-neutral CourseQueryResult.
   *
   * `courseId` is intentionally mapped to the public query projection's
   * `id` field. The read-model storage identity must not leak into the
   * public application vocabulary.
   */
  private static toQueryResult(record: {
    readonly courseId: string;
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
      id: record.courseId,
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
   * Empty datasets intentionally report zero total pages, preserving the
   * existing API behavior.
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