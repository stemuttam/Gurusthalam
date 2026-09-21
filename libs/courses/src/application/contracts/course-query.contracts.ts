import type { PaginatedResult } from '@gurusthalam/types';

import type {
  CourseSearchCriteria,
  CourseSearchRequest,
} from './course-search.contracts.js';

/**
 * Read-side projection returned by the Course query boundary.
 *
 * This is intentionally not the Course aggregate.
 *
 * Query consumers should receive only the data required for
 * discovery/read scenarios without forcing aggregate rehydration,
 * ownership reconstruction, domain-event state, or persistence details.
 */
export interface CourseQueryResult {
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
 * Course query criteria.
 *
 * This aliases the already-established 4.9-F search vocabulary so the
 * query boundary does not introduce a second, competing filter model.
 */
export type CourseQueryCriteria = CourseSearchCriteria;

/**
 * Request accepted by the Course query boundary.
 *
 * The request intentionally reuses the validated search contract rather
 * than inventing another pagination/filter shape.
 */
export type CourseQueryRequest = CourseSearchRequest;

/**
 * Paginated Course query result.
 *
 * Pagination metadata is supplied by the shared pagination contract.
 */
export type CourseQueryResultPage = PaginatedResult<CourseQueryResult>;

/**
 * Read/query boundary for Course discovery and listing scenarios.
 *
 * This is intentionally separate from CourseRepository:
 * - CourseRepository owns aggregate persistence semantics;
 * - CourseQuery owns read/query semantics.
 *
 * The implementation may later use Prisma, SQL, a read model, an index,
 * or another query-oriented data source without changing this contract.
 */
export interface CourseQuery {
  /**
   * Executes a Course query using the established search criteria,
   * pagination, and ordering vocabulary.
   *
   * The implementation must return deterministic pagination metadata
   * and query projections rather than hydrated Course aggregates.
   */
  search(request: CourseQueryRequest): Promise<CourseQueryResultPage>;
}
