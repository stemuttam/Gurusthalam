export type {
  CourseApplicationService,
  CreateCourseInput,
  GetCourseInput,
  SaveCourseInput,
  UpdateCourseInput,
  UpdateMetadataInput,
  CourseOwnershipAssignmentInput,
  AssignCourseOwnershipInput,
  RemoveCourseOwnershipInput,
  ReplaceCourseOwnershipInput,
  SubmitCourseForReviewInput,
  RequestCourseChangesInput,
  PublishCourseInput,
} from './contracts/index.js';

export type {
  CourseVersionApplicationService,
  CreateCourseVersionInput,
  PublishCourseVersionInput,
} from './contracts/index.js';

export type {
  CourseVersionRollbackApplicationResult,
  CourseVersionRollbackApplicationService,
  CourseVersionRollbackInput,
  CourseVersionRollbackPersistence,
  CourseVersionRollbackTransactionContext,
} from './contracts/index.js';

export {
  courseIdInputSchema,
  courseExistsInputSchema,
  createCourseInputSchema,
  getCourseInputSchema,
  updateCourseInputSchema,
  updateMetadataInputSchema,
  assignCourseOwnershipInputSchema,
  removeCourseOwnershipInputSchema,
  replaceCourseOwnershipInputSchema,
  courseLifecycleCommandInputSchema,
  submitCourseForReviewInputSchema,
  requestCourseChangesInputSchema,
  publishCourseInputSchema,
} from './contracts/index.js';

export type {
  CourseExistsInputSchema,
  CreateCourseInputSchema,
  GetCourseInputSchema,
  UpdateCourseInputSchema,
  UpdateMetadataInputSchema,
  CourseOwnershipAssignmentInputSchema,
  AssignCourseOwnershipInputSchema,
  RemoveCourseOwnershipInputSchema,
  ReplaceCourseOwnershipInputSchema,
  CourseLifecycleCommandInputSchema,
  SubmitCourseForReviewInputSchema,
  RequestCourseChangesInputSchema,
  PublishCourseInputSchema,
} from './contracts/index.js';

export {
  createCourseVersionInputSchema,
  publishCourseVersionInputSchema,
} from './contracts/index.js';

export type {
  CreateCourseVersionInputSchema,
  PublishCourseVersionInputSchema,
} from './contracts/index.js';

export { courseVersionRollbackInputSchema } from './contracts/index.js';

export type {
  CourseVersionRollbackInputSchema,
} from './contracts/index.js';

/**
 * Application services.
 *
 * Query orchestration is deliberately exported separately from the
 * mutation application service so consumers cannot accidentally use
 * aggregate mutation services for read scenarios.
 */
export {
  DefaultCourseApplicationService,
  DefaultCourseQueryApplicationService,
  DefaultCourseVersionApplicationService,
  DefaultCourseVersionRollbackApplicationService,
} from './services/index.js';

export type {
  CourseSearchCriteria,
  CourseSearchInput,
  CourseSearchRequest,
  CourseSearchSortField,
} from './contracts/index.js';

export { COURSE_SEARCH_SORT_FIELDS } from './contracts/index.js';

export { courseSearchInputSchema } from './contracts/index.js';

export type {
  CourseSearchInputSchema,
} from './contracts/index.js';

export type {
  CourseQuery,
  CourseQueryCriteria,
  CourseQueryRequest,
  CourseQueryResult,
  CourseQueryResultPage,
  CourseQueryInputSchema,
  CourseQueryValidatedSchema,
} from './contracts/index.js';

export { courseQueryInputSchema } from './contracts/index.js';

/**
 * Course read-model projections
 *
 * These are derived read-side representations.
 *
 * They remain independent from:
 * - Prisma;
 * - PostgreSQL;
 * - HTTP/NestJS;
 * - domain-event transport;
 * - search-engine vendors;
 * - vector databases;
 * - AI/ML infrastructure.
 */
export {
  COURSE_CATALOG_PROJECTION_SCHEMA_VERSION,
  createCourseCatalogProjection,
  COURSE_SEARCH_PROJECTION_SCHEMA_VERSION,
  COURSE_SEARCH_SOURCE_CATALOG_SCHEMA_VERSION,
  createCourseSearchProjection,
  createCourseSearchText,
} from './read-models/index.js';

export type {
  CourseCatalogProjection,
  CourseCatalogProjectionSchemaVersion,
  CourseSearchProjection,
  CourseSearchProjectionSchemaVersion,
  CourseCatalogProjectionPersistence,
  CourseSearchProjectionPersistence,
  CourseProjectionPersistence,
} from './read-models/index.js';

export type {
  CourseCatalogProjectionQuery,
} from './read-models/index.js';