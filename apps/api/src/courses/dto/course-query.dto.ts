import type {
  CourseQueryInputSchema,
  CourseQueryResultPage,
} from '@gurusthalam/courses';

/**
 * HTTP transport contract for Course discovery/query operations.
 *
 * Important:
 * HTTP query parameters arrive as strings. Therefore pagination values
 * intentionally remain strings at this boundary.
 *
 * Runtime validation, coercion, defaults, enum validation, pagination
 * limits, and sort validation are owned by the Course application layer.
 *
 * This DTO deliberately contains no:
 * - Prisma types;
 * - SQL operators;
 * - persistence filters;
 * - domain logic;
 * - application defaults;
 */
export interface CourseQueryDto {
  readonly query?: string;
  readonly status?: string;
  readonly visibility?: string;
  readonly level?: string;
  readonly type?: string;
  readonly instructorId?: string;

  /**
   * HTTP query-string values.
   *
   * These are intentionally strings and are converted only into the
   * application validation input representation.
   */
  readonly page?: string;
  readonly limit?: string;

  readonly sortBy?: string;
  readonly sortOrder?: string;
}

/**
 * HTTP response representation for one Course discovery result.
 *
 * This is intentionally an explicit API projection rather than exposing
 * the application contract object directly.
 */
export interface CourseQueryItemDto {
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
}

/**
 * HTTP pagination metadata.
 */
export interface CourseQueryPaginationMetaDto {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
}

/**
 * HTTP response contract for Course discovery.
 */
export interface CourseQueryResponseDto {
  readonly items: readonly CourseQueryItemDto[];
  readonly meta: CourseQueryPaginationMetaDto;
}

/**
 * Maps the HTTP transport representation into the raw application
 * validation input.
 *
 * This function intentionally:
 * - does not validate;
 * - does not apply defaults;
 * - does not coerce pagination values;
 * - does not validate enum values.
 *
 * Those responsibilities remain at the application validation boundary.
 *
 * The small type assertions on enum-like fields are intentional:
 * NestJS receives arbitrary HTTP strings, while the application input
 * contract describes the vocabulary eventually validated by Zod.
 */
export function mapCourseQueryDtoToApplicationRequest(
  request: CourseQueryDto,
): CourseQueryInputSchema {
  return {
    ...(request.query !== undefined
      ? {
          query: request.query,
        }
      : {}),

    ...(request.status !== undefined
      ? {
          status: request.status as CourseQueryInputSchema['status'],
        }
      : {}),

    ...(request.visibility !== undefined
      ? {
          visibility:
            request.visibility as CourseQueryInputSchema['visibility'],
        }
      : {}),

    ...(request.level !== undefined
      ? {
          level: request.level as CourseQueryInputSchema['level'],
        }
      : {}),

    ...(request.type !== undefined
      ? {
          type: request.type as CourseQueryInputSchema['type'],
        }
      : {}),

    ...(request.instructorId !== undefined
      ? {
          instructorId: request.instructorId,
        }
      : {}),

    ...(request.page !== undefined
      ? {
          page: request.page,
        }
      : {}),

    ...(request.limit !== undefined
      ? {
          limit: request.limit,
        }
      : {}),

    ...(request.sortBy !== undefined
      ? {
          sortBy: request.sortBy as CourseQueryInputSchema['sortBy'],
        }
      : {}),

    ...(request.sortOrder !== undefined
      ? {
          sortOrder:
            request.sortOrder as CourseQueryInputSchema['sortOrder'],
        }
      : {}),
  };
}

/**
 * Maps the application read-model result into the explicit HTTP response
 * contract.
 *
 * The mapping intentionally creates fresh objects so the API layer never
 * leaks application-owned object identity or accidentally mutates the
 * application result.
 */
export function mapCourseQueryResultPageToResponseDto(
  result: CourseQueryResultPage,
): CourseQueryResponseDto {
  return {
    items: result.items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      level: item.level,
      type: item.type,
      visibility: item.visibility,
      status: item.status,
      instructorId: item.instructorId,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),

    meta: {
      page: result.meta.page,
      limit: result.meta.limit,
      total: result.meta.total,
      totalPages: result.meta.totalPages,
      hasNextPage: result.meta.hasNextPage,
      hasPreviousPage: result.meta.hasPreviousPage,
    },
  };
}