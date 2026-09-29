import type { CourseCatalogProjection } from './course-catalog.projection.js';
import type { CourseSearchProjection } from './course-search.projection.js';

/**
 * Result of attempting to apply a projection update.
 *
 * `true`
 *   The supplied projection became the persisted canonical state.
 *
 * `false`
 *   The supplied projection was stale and the persisted state was left
 *   unchanged.
 *
 * The distinction is important for projection ordering:
 *
 *   newer event
 *        ↓
 *   catalog accepted
 *        ↓
 *   search may be updated
 *
 * while:
 *
 *   older event
 *        ↓
 *   catalog rejected
 *        ↓
 *   search must NOT be overwritten
 */
export type CourseProjectionWriteResult = boolean;

/**
 * Infrastructure-neutral persistence contract for the CourseCatalog
 * read model.
 *
 * This contract deliberately persists the already-defined
 * CourseCatalogProjection. It does not define:
 *
 * - Prisma models;
 * - SQL;
 * - database transactions;
 * - domain-event handling;
 * - query/filter semantics;
 * - authorization;
 * - aggregate behavior;
 * - search-engine implementation;
 * - embeddings;
 * - vector storage;
 * - AI metadata.
 *
 * Those concerns belong to infrastructure/application boundaries.
 *
 * The transactional Course remains the authoritative source of truth.
 */
export interface CourseCatalogProjectionPersistence {
  /**
   * Creates or updates the persisted CourseCatalog projection.
   *
   * Implementations MUST enforce the ordering boundary atomically with the
   * persistence operation.
   *
   * The projection identity is courseId.
   *
   * Ordering is defined by updatedAt:
   *
   * - equal timestamp: accepted;
   * - newer timestamp: accepted;
   * - older timestamp: rejected.
   *
   * The comparison and write must form one concurrency-safe persistence
   * boundary. An implementation must not rely on:
   *
   *   read → compare → write
   *
   * as separate database operations.
   *
   * This requirement makes replay and concurrent out-of-order delivery safe.
   */
  upsert(
    projection: CourseCatalogProjection,
  ): Promise<CourseProjectionWriteResult>;

  /**
   * Finds a persisted CourseCatalog projection by its stable Course ID.
   *
   * A missing projection is represented by null rather than an exception.
   */
  findByCourseId(courseId: string): Promise<CourseCatalogProjection | null>;

  /**
   * Removes a persisted CourseCatalog projection.
   *
   * This operation belongs to the projection lifecycle and does not imply
   * deletion of the transactional Course aggregate.
   */
  removeByCourseId(courseId: string): Promise<void>;
}

/**
 * Infrastructure-neutral persistence contract for the CourseSearch
 * read model.
 *
 * CourseSearchProjection is derived from CourseCatalogProjection.
 *
 * The search persistence boundary intentionally does not expose:
 *
 * - search-engine-specific APIs;
 * - ranking;
 * - embeddings;
 * - vector IDs;
 * - AI model IDs;
 * - recommendation scores;
 * - agent state.
 */
export interface CourseSearchProjectionPersistence {
  /**
   * Creates or updates the persisted CourseSearch projection.
   *
   * Implementations MUST enforce the same atomic updatedAt ordering
   * boundary as the catalog persistence implementation.
   *
   * Equal/newer projections may be applied.
   * Older projections must be rejected without changing persisted state.
   */
  upsert(
    projection: CourseSearchProjection,
  ): Promise<CourseProjectionWriteResult>;

  /**
   * Finds a persisted CourseSearch projection by Course ID.
   */
  findByCourseId(courseId: string): Promise<CourseSearchProjection | null>;

  /**
   * Removes a persisted CourseSearch projection without implying that the
   * transactional Course itself has been deleted.
   */
  removeByCourseId(courseId: string): Promise<void>;
}

/**
 * Combined Course projection persistence boundary.
 *
 * This interface is intentionally a composition of the two independently
 * evolving projection stores rather than a single generic "Course read
 * repository".
 */
export interface CourseProjectionPersistence {
  readonly catalog: CourseCatalogProjectionPersistence;
  readonly search: CourseSearchProjectionPersistence;
}
