export { Course } from './domain/entities/course.js';

export type {
  CourseProps,
  CreateCourseProps,
  UpdateCourseMetadataProps,
} from './domain/entities/course.js';

export {
  CourseLevel,
  COURSE_LEVELS,
  isCourseLevel,
} from './domain/enums/course-level.js';

export type { CourseLevel as CourseLevelValue } from './domain/enums/course-level.js';

export {
  CourseStatus,
  COURSE_STATUSES,
  isCourseStatus,
} from './domain/enums/course-status.js';

export type { CourseStatus as CourseStatusValue } from './domain/enums/course-status.js';

export {
  CourseType,
  COURSE_TYPES,
  isCourseType,
} from './domain/enums/course-type.js';

export type { CourseType as CourseTypeValue } from './domain/enums/course-type.js';

export {
  CourseVisibility,
  COURSE_VISIBILITIES,
  isCourseVisibility,
} from './domain/enums/course-visibility.js';

export type { CourseVisibility as CourseVisibilityValue } from './domain/enums/course-visibility.js';

export {
  CourseDomainErrorCode,
  CourseValidationError,
  InvalidCourseStateTransitionError,
} from './domain/errors/index.js';

export type {
  CourseDomainError,
  CourseValidationIssue,
} from './domain/errors/index.js';

export { CourseId } from './domain/value-objects/course-id.js';

/**
 * Course metadata domain contracts
 *
 * These contracts establish the domain boundary for core metadata,
 * taxonomy metadata, and discovery metadata without coupling the
 * Course domain to persistence, HTTP, infrastructure, or AI/ML
 * implementation details.
 */
export {
  createCourseCoreMetadata,
  createCourseDiscoveryMetadata,
  createCourseMetadata,
  createCourseTaxonomyMetadata,
} from './domain/metadata/index.js';

export type {
  CourseCoreMetadata,
  CourseDiscoveryMetadata,
  CourseMetadata,
  CourseMetadataPatch,
  CourseTaxonomyMetadata,
} from './domain/metadata/index.js';

export { CourseVersion } from './domain/entities/course-version.js';

export type {
  CourseVersionProps,
  CreateCourseVersionProps,
} from './domain/entities/course-version.js';

export { CourseVersionId } from './domain/value-objects/course-version-id.js';

export {
  CategoryReference,
  SkillReference,
  SubcategoryReference,
  SubjectReference,
  TopicReference,
} from './domain/value-objects/index.js';

/**
 * CourseVersion lifecycle status
 */
export {
  CourseVersionStatus,
  COURSE_VERSION_STATUSES,
  isCourseVersionStatus,
} from './domain/enums/course-version-status.js';

export type { CourseVersionStatus as CourseVersionStatusValue } from './domain/enums/course-version-status.js';

export type { CourseRepository } from './domain/repositories/course-repository.js';

export type { CourseVersionRepository } from './domain/repositories/course-version-repository.js';

/**
 * Domain events
 */
export {
  createDomainEvent,
  CourseDomainEventName,
} from './domain/events/index.js';

export type {
  DomainEvent,
  CourseArchivedEvent,
  CourseCreatedEvent,
  CourseCreatedPayload,
  CourseDomainEvent,
  CourseMetadataUpdatedEvent,
  CourseMetadataUpdatedPayload,
  CoursePublishedEvent,
  CourseStatusChangedPayload,
  CourseSubmittedForReviewEvent,
  CourseUnpublishedEvent,
} from './domain/events/index.js';

/**
 * Application layer
 */
export { DefaultCourseApplicationService } from './application/index.js';

export type {
  CourseApplicationService,
  CreateCourseInput,
  GetCourseInput,
  SaveCourseInput,
  CourseExistsInputSchema,
  CreateCourseInputSchema,
  GetCourseInputSchema,
} from './application/index.js';

export {
  courseIdInputSchema,
  courseExistsInputSchema,
  createCourseInputSchema,
  getCourseInputSchema,
} from './application/index.js';
