export {
  CoursesPersistenceModule,
  COURSE_QUERY,
  COURSE_REPOSITORY,
  COURSE_VERSION_REPOSITORY,
  COURSE_VERSION_AUDIT_REPOSITORY,
  COURSE_VERSION_LINEAGE_REPOSITORY,
  PrismaCourseQuery,
  PrismaCourseRepository,
  PrismaCourseVersionRepository,
  PrismaCourseVersionAuditRepository,
  PrismaCourseVersionLineageRepository,
} from './courses/index.js';
export {} from '../read-models/index.js';

export {
  ENROLLMENT_REPOSITORY,
  LearningPersistenceModule,
  PrismaEnrollmentRepository,
} from './learning/index.js';
