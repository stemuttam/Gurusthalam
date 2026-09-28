import type {
  CourseQuery,
  CourseQueryRequest,
  CourseQueryResultPage,
} from '../contracts/course-query.contracts.js';

/**
 * Read-model query boundary for the canonical CourseCatalog projection.
 *
 * This is an additive specialization of the existing CourseQuery contract.
 *
 * Architectural intent:
 *
 * Transactional Course
 *        ↓
 * Course Domain Events
 *        ↓
 * CourseProjectionEventHandler
 *        ↓
 * CourseCatalogProjection
 *        ↓
 * CourseCatalogProjectionQuery
 *        ↓
 * CourseQuery
 *        ↓
 * DefaultCourseQueryApplicationService
 *
 * The existing CourseQuery contract remains the public application
 * read/query boundary. This interface identifies implementations that
 * specifically serve that boundary from the CourseCatalog read model.
 *
 * Deliberately excluded:
 * - Prisma;
 * - SQL;
 * - database-specific types;
 * - NestJS;
 * - HTTP;
 * - authorization;
 * - authentication;
 * - aggregate mutation;
 * - domain-event publication;
 * - search-engine APIs;
 * - embeddings;
 * - vector storage;
 * - ranking models;
 * - recommendation models;
 * - LLM state;
 * - agent state.
 *
 * Concrete persistence/query implementations are intentionally deferred
 * to the PostgreSQL/read-model infrastructure boundary in 4.14-F.
 */
export interface CourseCatalogProjectionQuery extends CourseQuery {
  /**
   * Executes a read-only query against the CourseCatalog projection.
   *
   * The request vocabulary remains the existing CourseQuery contract.
   *
   * Implementations must:
   * - return read-side projections;
   * - never hydrate Course aggregates;
   * - never mutate transactional Course state;
   * - preserve deterministic pagination metadata;
   * - keep CourseCatalogProjection as the canonical catalog source;
   * - remain replaceable by future PostgreSQL/search infrastructure.
   */
  search(request: CourseQueryRequest): Promise<CourseQueryResultPage>;
}
