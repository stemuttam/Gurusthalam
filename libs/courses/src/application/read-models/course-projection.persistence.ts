import type { CourseCatalogProjection } from './course-catalog.projection.js';
import type { CourseSearchProjection } from './course-search.projection.js';

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
 * Those concerns belong to later architectural boundaries.
 *
 * The transactional Course remains the authoritative source of truth.
 * CourseCatalogProjection is only a derived read representation.
 */
export interface CourseCatalogProjectionPersistence {
  /**
   * Creates or replaces the persisted CourseCatalog projection for a
   * Course.
   *
   * Implementations must treat courseId as the stable projection identity.
   *
   * The operation is intentionally expressed as an upsert-style semantic
   * rather than separate create/update methods because projection workers
   * must be able to safely rebuild a projection from authoritative
   * Course state.
   */
  upsert(projection: CourseCatalogProjection): Promise<void>;

  /**
   * Finds a persisted CourseCatalog projection by its stable Course ID.
   *
   * A missing projection is represented by null rather than an exception.
   *
   * This supports:
   * - projection verification;
   * - rebuild workflows;
   * - reconciliation;
   * - future read-side diagnostics.
   */
  findByCourseId(courseId: string): Promise<CourseCatalogProjection | null>;

  /**
   * Removes a persisted CourseCatalog projection.
   *
   * This operation belongs to the projection lifecycle and does not imply
   * deletion of the transactional Course aggregate.
   *
   * It can be used by future projection rebuild/reconciliation workflows
   * when a projection must be explicitly removed.
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
 * - search-engine-specific APIs;
 * - ranking;
 * - embeddings;
 * - vector IDs;
 * - AI model IDs;
 * - recommendation scores;
 * - agent state.
 *
 * Those concerns remain outside the Course domain read-model contract.
 */
export interface CourseSearchProjectionPersistence {
  /**
   * Creates or replaces the persisted CourseSearch projection.
   *
   * Implementations must use courseId as the stable projection identity.
   *
   * The operation is intentionally idempotent at the contract level:
   * replaying the same projection must not require callers to distinguish
   * between an initial insert and a subsequent update.
   */
  upsert(projection: CourseSearchProjection): Promise<void>;

  /**
   * Finds a persisted CourseSearch projection by Course ID.
   *
   * A missing projection is represented by null.
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
 *
 * Keeping the boundaries explicit allows the platform to evolve:
 *
 * Course
 *   ↓
 * CourseCatalogProjection
 *   ↓
 * CourseCatalogPersistence
 *
 * and independently:
 *
 * CourseCatalogProjection
 *   ↓
 * CourseSearchProjection
 *   ↓
 * CourseSearchPersistence
 *
 * without coupling catalog persistence to a particular search technology.
 */
export interface CourseProjectionPersistence {
  readonly catalog: CourseCatalogProjectionPersistence;
  readonly search: CourseSearchProjectionPersistence;
}
