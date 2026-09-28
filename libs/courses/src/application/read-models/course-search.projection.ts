import type { CourseCatalogProjection } from './course-catalog.projection.js';
import {
  COURSE_CATALOG_PROJECTION_SCHEMA_VERSION,
  createCourseCatalogProjection,
} from './course-catalog.projection.js';

/**
 * Schema version of the CourseSearch projection contract.
 *
 * Search representation is intentionally independently versioned from
 * future search-engine/index implementations.
 */
export const COURSE_SEARCH_PROJECTION_SCHEMA_VERSION = 1 as const;

export type CourseSearchProjectionSchemaVersion =
  typeof COURSE_SEARCH_PROJECTION_SCHEMA_VERSION;

/**
 * Search-side representation of a Course.
 *
 * CourseSearchProjection is intentionally derived from the canonical
 * CourseCatalog projection instead of independently modelling Course
 * transactional state.
 *
 * This gives the platform:
 *
 * Transactional Course
 *        ↓
 * CourseCatalogProjection
 *        ↓
 * CourseSearchProjection
 *
 * while preventing the search representation from becoming a second
 * source of business truth.
 *
 * IMPORTANT:
 * No AI/vendor-specific state belongs here.
 *
 * Deliberately excluded:
 * - embeddings;
 * - vector IDs;
 * - model IDs;
 * - ranking scores;
 * - recommendation scores;
 * - LLM metadata;
 * - AI confidence;
 * - agent state.
 *
 * Those belong to future intelligence infrastructure.
 */
export interface CourseSearchProjection extends CourseCatalogProjection {
  /**
   * Deterministic searchable representation derived from Course fields.
   *
   * This is intentionally a plain textual representation.
   *
   * It can later be consumed by:
   * - PostgreSQL text search;
   * - dedicated search indexes;
   * - lexical retrieval;
   * - semantic retrieval preparation;
   * - RAG indexing pipelines.
   *
   * The field itself does not imply a particular search technology.
   */
  readonly searchText: string;

  /**
   * Independent schema version for the search projection.
   */
  readonly searchProjectionSchemaVersion: CourseSearchProjectionSchemaVersion;
}

/**
 * Normalizes a Course field for deterministic search-document creation.
 *
 * This is deliberately conservative:
 * - converts null/undefined to an empty string;
 * - collapses repeated whitespace;
 * - trims surrounding whitespace.
 *
 * It does not perform language-specific stemming, tokenization,
 * transliteration, embedding, ranking or semantic interpretation.
 */
function normalizeSearchField(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Builds the deterministic Course search document.
 *
 * The ordering is intentional and stable:
 *
 * title
 * description
 *
 * Additional semantic fields can be incorporated later through a
 * versioned projection evolution rather than silently changing the
 * meaning of the existing representation.
 */
export function createCourseSearchText(input: {
  readonly title: string;
  readonly description: string | null;
}): string {
  return [
    normalizeSearchField(input.title),
    normalizeSearchField(input.description),
  ]
    .filter((value) => value.length > 0)
    .join(' ');
}

/**
 * Creates an immutable CourseSearch projection from a canonical
 * CourseCatalog projection.
 *
 * Keeping this transformation explicit prevents two independent Course
 * read models from drifting apart.
 */
export function createCourseSearchProjection(
  catalog: CourseCatalogProjection,
  options?: {
    readonly searchText?: string;
  },
): CourseSearchProjection {
  const normalizedCatalog = createCourseCatalogProjection(catalog);

  return Object.freeze({
    ...normalizedCatalog,
    searchText:
      options?.searchText ??
      createCourseSearchText({
        title: normalizedCatalog.title,
        description: normalizedCatalog.description,
      }),
    searchProjectionSchemaVersion: COURSE_SEARCH_PROJECTION_SCHEMA_VERSION,
  });
}

/**
 * Compile-time relationship guard.
 *
 * The CourseCatalog projection schema version is intentionally referenced
 * here so a future breaking catalog projection change cannot accidentally
 * become invisible to the search projection implementation.
 */
export const COURSE_SEARCH_SOURCE_CATALOG_SCHEMA_VERSION =
  COURSE_CATALOG_PROJECTION_SCHEMA_VERSION;
