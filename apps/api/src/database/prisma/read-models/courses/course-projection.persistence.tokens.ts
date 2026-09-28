/**
 * NestJS infrastructure tokens for Course read-model persistence.
 *
 * These tokens deliberately remain separate from:
 *
 * COURSE_REPOSITORY
 * COURSE_QUERY
 * COURSE_VERSION_REPOSITORY
 *
 * because Course projection persistence is a distinct read-model
 * infrastructure boundary.
 */
export const COURSE_CATALOG_PROJECTION_PERSISTENCE = Symbol(
  'COURSE_CATALOG_PROJECTION_PERSISTENCE',
);

export const COURSE_SEARCH_PROJECTION_PERSISTENCE = Symbol(
  'COURSE_SEARCH_PROJECTION_PERSISTENCE',
);
