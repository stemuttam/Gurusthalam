export {
  CourseStatus,
  COURSE_STATUSES,
  isCourseStatus,
} from './domain/enums/course-status.js';

export type {
  CourseStatus as CourseStatusValue,
} from './domain/enums/course-status.js';

export {
  CourseVisibility,
  COURSE_VISIBILITIES,
  isCourseVisibility,
} from './domain/enums/course-visibility.js';

export type {
  CourseVisibility as CourseVisibilityValue,
} from './domain/enums/course-visibility.js';

export {
  CourseLevel,
  COURSE_LEVELS,
  isCourseLevel,
} from './domain/enums/course-level.js';

export type {
  CourseLevel as CourseLevelValue,
} from './domain/enums/course-level.js';

export {
  CourseType,
  COURSE_TYPES,
  isCourseType,
} from './domain/enums/course-type.js';

export type {
  CourseType as CourseTypeValue,
} from './domain/enums/course-type.js';

export {
  CourseDomainError,
  CourseDomainErrorCode,
} from './domain/errors/course-domain.error.js';

export type {
  CourseDomainErrorCode as CourseDomainErrorCodeValue,
} from './domain/errors/course-domain.error.js';

export {
  CourseValidationError,
} from './domain/errors/course-validation.error.js';

export type {
  CourseValidationIssue,
} from './domain/errors/course-validation.error.js';

export {
  InvalidCourseStateTransitionError,
} from './domain/errors/invalid-course-state-transition.error.js';

export {
  Course,
} from './domain/entities/course.js';

export type {
  CourseProps,
  CreateCourseProps,
  UpdateCourseMetadataProps,
} from './domain/entities/course.js';

export {
  CourseVersion,
} from './domain/entities/course-version.js';

export type {
  CourseVersionProps,
  CreateCourseVersionProps,
  CourseVersionStatus,
} from './domain/entities/course-version.js';

export {
  CourseId,
  CourseVersionId,
} from './domain/value-objects/index.js';

export type {
  CourseRepository,
  CourseVersionRepository,
} from './domain/repositories/index.js';

/**
 * Application layer.
 *
 * Application services orchestrate use cases while remaining independent
 * from infrastructure concerns such as NestJS and Prisma.
 */
export {
  DefaultCourseApplicationService,
} from './application/index.js';

export type {
  CourseApplicationService,
  CreateCourseInput,
  GetCourseInput,
  SaveCourseInput,
} from './application/index.js';