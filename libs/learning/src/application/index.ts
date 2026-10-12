export { DefaultEnrollmentApplicationService } from './services/enrollment-application.service.js';

export { DefaultEntitlementApplicationService } from './services/entitlement-application.service.js';

export { DefaultLessonProgressApplicationService } from './services/lesson-progress-application.service.js';

export { DefaultProgressApplicationService } from './services/progress-application.service.js';

export { DefaultSectionProgressApplicationService } from './services/section-progress-application.service.js';

export type {
  CancelEnrollmentInput,
  EnrollLearnerInput,
  EnrollmentApplicationService,
  GetEnrollmentInput,
} from './contracts/index.js';

export {
  cancelEnrollmentInputSchema,
  enrollLearnerInputSchema,
  getEnrollmentInputSchema,
} from './contracts/index.js';

export type {
  CheckEntitlementAccessInput,
  EntitlementApplicationService,
  ExpireEntitlementInput,
  GrantEntitlementInput,
  RestoreEntitlementInput,
  RevokeEntitlementInput,
  SuspendEntitlementInput,
} from './contracts/index.js';

export {
  checkEntitlementAccessInputSchema,
  expireEntitlementInputSchema,
  getEntitlementInputSchema,
  grantEntitlementInputSchema,
  restoreEntitlementInputSchema,
  revokeEntitlementInputSchema,
  suspendEntitlementInputSchema,
} from './contracts/index.js';

export type {
  CompleteLessonProgressInput,
  GetLessonProgressByEnrollmentAndLearningUnitInput,
  GetLessonProgressInput,
  LessonProgressApplicationService,
  StartLessonProgressInput,
  UpdateLessonProgressInput,
} from './contracts/index.js';

export {
  LessonProgressApplicationError,
  LessonProgressApplicationErrorCode,
  LessonProgressAccessDeniedError,
  type LessonProgressAccessDeniedReason,
  type LessonProgressApplicationErrorIssue,
} from './errors/lesson-progress-application.error.js';

export type {
  CompleteProgressInput,
  GetProgressByEnrollmentInput,
  GetProgressInput,
  ProgressApplicationService,
  StartProgressInput,
  UpdateProgressInput,
} from './contracts/index.js';

export {
  completeProgressInputSchema,
  getProgressByEnrollmentInputSchema,
  getProgressInputSchema,
  startProgressInputSchema,
  updateProgressInputSchema,
} from './contracts/index.js';

export {
  ProgressApplicationError,
  ProgressApplicationErrorCode,
  ProgressAccessDeniedError,
  type ProgressAccessDeniedReason,
  type ProgressApplicationErrorIssue,
} from './errors/progress-application.error.js';

export {
  EntitlementAccessDecisionReason,
  evaluateEntitlementAccess,
  type EntitlementAccessDecision,
  type EntitlementAccessPolicyInput,
} from './policies/entitlement-access.policy.js';

export type {
  CompleteSectionProgressInput,
  GetSectionProgressByEnrollmentAndSectionInput,
  GetSectionProgressInput,
  SectionProgressApplicationService,
  StartSectionProgressInput,
  UpdateSectionProgressInput,
} from './contracts/index.js';

export {
  completeSectionProgressInputSchema,
  getSectionProgressByEnrollmentAndSectionInputSchema,
  getSectionProgressInputSchema,
  startSectionProgressInputSchema,
  updateSectionProgressInputSchema,
} from './contracts/index.js';

export {
  SectionProgressApplicationError,
  SectionProgressApplicationErrorCode,
  SectionProgressAccessDeniedError,
  type SectionProgressAccessDeniedReason,
  type SectionProgressApplicationErrorIssue,
} from './errors/section-progress-application.error.js';

export type {
  LearningActivityEventRepository,
  LearningActivityEventPersistenceResult,
} from './contracts/index.js';

export { LearningActivityEventIdentityConflictError } from './contracts/index.js';

export type {
  LearningHistoryCursor,
  LearningHistoryEntry,
  LearningHistoryQueryRepository,
  ListLearningHistoryInput,
  ListLearningHistoryResult,
  ListQualifyingLearningActivityDaysInput,
} from './contracts/index.js';

export {
  listLearningHistoryInputSchema,
  listQualifyingLearningActivityDaysInputSchema,
  type ListLearningHistoryInputValue,
  type ValidatedListLearningHistoryInput,
  type ListQualifyingLearningActivityDaysInputValue,
  type ValidatedListQualifyingLearningActivityDaysInput,
} from './contracts/index.js';

export type {
  CourseProgressReadModelRepository,
  CourseProgressReadModelSaveOutcome,
  CourseProgressReadModelSaveResult,
} from './contracts/index.js';

export {
  CourseProgressReadModelTimestampConflictError,
  CourseProgressReadModelVersionConflictError,
} from './contracts/index.js';

export type {
  CourseProgressApplicationService,
  GetCourseProgressInput,
  RefreshCourseProgressInput,
  RefreshCourseProgressResult,
} from './contracts/index.js';

export {
  DefaultCourseProgressApplicationService,
  CourseProgressApplicationError,
} from './services/course-progress-application.service.js';
