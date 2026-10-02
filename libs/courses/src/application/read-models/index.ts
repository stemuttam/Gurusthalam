export {
  COURSE_CATALOG_PROJECTION_SCHEMA_VERSION,
  createCourseCatalogProjection,
} from './course-catalog.projection.js';

export type {
  CourseCatalogProjection,
  CourseCatalogProjectionSchemaVersion,
} from './course-catalog.projection.js';

export {
  COURSE_SEARCH_PROJECTION_SCHEMA_VERSION,
  COURSE_SEARCH_SOURCE_CATALOG_SCHEMA_VERSION,
  createCourseSearchProjection,
  createCourseSearchText,
} from './course-search.projection.js';

export type {
  CourseSearchProjection,
  CourseSearchProjectionSchemaVersion,
} from './course-search.projection.js';

export type {
  CourseCatalogProjectionPersistence,
  CourseProjectionPersistence,
  CourseSearchProjectionPersistence,
} from './course-projection.persistence.js';

export type { CourseCatalogProjectionQuery } from './course-catalog.query.js';

export {
  CourseProjectionEventHandler,
  CourseProjectionSourceMissingError,
} from './course-projection.event-handler.js';