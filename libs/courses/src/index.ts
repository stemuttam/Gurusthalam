export { Course } from './domain/entities/course.js';

export type {
  CourseProps,
  CreateCourseProps,
  UpdateCourseMetadataProps,
} from './domain/entities/course.js';

/**
 * Course level
 */
export {
  CourseLevel,
  COURSE_LEVELS,
  isCourseLevel,
} from './domain/enums/course-level.js';

export type { CourseLevel as CourseLevelValue } from './domain/enums/course-level.js';

/**
 * Course status
 */
export {
  CourseStatus,
  COURSE_STATUSES,
  isCourseStatus,
} from './domain/enums/course-status.js';

export type { CourseStatus as CourseStatusValue } from './domain/enums/course-status.js';

/**
 * Course lifecycle policy
 *
 * Defines the immutable domain-owned lifecycle transition graph
 * and exposes lifecycle eligibility capabilities without
 * coupling consumers to Course aggregate internals.
 *
 * The policy is intentionally independent of:
 * - persistence
 * - Prisma
 * - HTTP
 * - NestJS
 * - queues
 * - notifications
 * - AI/ML infrastructure
 */
export {
  COURSE_LIFECYCLE_TRANSITIONS,
  canTransitionCourseLifecycle,
  getAllowedCourseLifecycleTransitions,
  isTerminalCourseLifecycleStatus,
} from './domain/lifecycle/course-lifecycle.policy.js';

/**
 * Course lifecycle capabilities
 *
 * Provides an immutable read-side lifecycle capability contract built
 * on top of the canonical Course lifecycle policy.
 *
 * This does not introduce a second lifecycle state machine.
 */
export { getCourseLifecycleCapabilities } from './domain/lifecycle/course-lifecycle.capabilities.js';

export type { CourseLifecycleCapabilities } from './domain/lifecycle/course-lifecycle.capabilities.js';

/**
 * Course type
 */
export {
  CourseType,
  COURSE_TYPES,
  isCourseType,
} from './domain/enums/course-type.js';

export type { CourseType as CourseTypeValue } from './domain/enums/course-type.js';

/**
 * Course visibility
 */
export {
  CourseVisibility,
  COURSE_VISIBILITIES,
  isCourseVisibility,
} from './domain/enums/course-visibility.js';

export type { CourseVisibility as CourseVisibilityValue } from './domain/enums/course-visibility.js';

/**
 * Domain errors
 */
export {
  CourseDomainErrorCode,
  CourseValidationError,
  InvalidCourseStateTransitionError,
} from './domain/errors/index.js';

export type {
  CourseDomainError,
  CourseValidationIssue,
} from './domain/errors/index.js';

/**
 * Course value objects
 */
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

/**
 * Course taxonomy vocabulary
 *
 * These contracts define the domain vocabulary for taxonomy concepts
 * without introducing persistence-specific identifiers or
 * infrastructure dependencies.
 */
export {
  createCategoryVocabularyEntry,
  createSkillVocabularyEntry,
  createSubcategoryVocabularyEntry,
  createSubjectVocabularyEntry,
  createTaxonomyVocabularyConcept,
  createTaxonomyVocabularyEntry,
  createTopicVocabularyEntry,
} from './domain/metadata/index.js';

export type {
  CategoryVocabularyEntry,
  CourseTaxonomyVocabularyReferences,
  SkillVocabularyEntry,
  SubcategoryVocabularyEntry,
  SubjectVocabularyEntry,
  TaxonomyConceptKind,
  TaxonomyVocabularyConcept,
  TaxonomyVocabularyEntry,
  TopicVocabularyEntry,
} from './domain/metadata/index.js';

/**
 * Course taxonomy value objects
 *
 * These strongly typed references protect the domain from accidentally
 * mixing category, subcategory, subject, topic, and skill identifiers.
 */
export {
  CategoryReference,
  SkillReference,
  SubcategoryReference,
  SubjectReference,
  TopicReference,
} from './domain/value-objects/index.js';

/**
 * Course discovery metadata
 *
 * Discovery metadata represents learner-facing discovery semantics such
 * as language, audience, structured difficulty signals, learning
 * objectives, and extension-safe future discovery signals.
 *
 * AI/ML ranking scores, embeddings, recommendation scores, and model
 * identifiers intentionally remain outside these transactional domain
 * contracts.
 */
export {
  AudienceReference,
  LanguageCode,
  createCourseDifficultySignal,
  createCourseDifficultySignals,
  createFutureDiscoverySignal,
  createLearningObjective,
  isValidDiscoverySignalKey,
  isValidDiscoverySignalValue,
  isValidLearningObjectiveStatement,
} from './domain/metadata/index.js';

export type {
  CourseDifficultySignal,
  CourseDifficultySignals,
  DifficultyDimension,
  DifficultySignalStrength,
  FutureDiscoverySignal,
  LearningObjective,
} from './domain/metadata/index.js';

/**
 * Course version
 */
export { CourseVersion } from './domain/entities/course-version.js';

export type {
  CourseVersionProps,
  CreateCourseVersionProps,
} from './domain/entities/course-version.js';

export { CourseVersionId } from './domain/value-objects/course-version-id.js';

/**
 * Course versioning
 *
 * Provides immutable, serializable snapshots and deterministic
 * snapshot comparison without coupling versioning to persistence,
 * HTTP, or infrastructure.
 *
 * Snapshot schema versioning is deliberately separate from the
 * business CourseVersion number so representation migrations can
 * evolve independently from educational content revisions.
 */
export {
  COURSE_VERSION_SNAPSHOT_SCHEMA_VERSION,
  createCourseVersionSnapshot,
} from './domain/versioning/course-version-snapshot.js';

export type { CourseVersionSnapshot } from './domain/versioning/course-version-snapshot.js';

export { compareCourseVersionSnapshots } from './domain/versioning/course-version-comparison.js';

export type {
  CourseVersionComparison,
  CourseVersionFieldChange,
  CourseVersionSnapshotComparableField,
} from './domain/versioning/course-version-comparison.js';

/**
 * Course version lineage
 *
 * Immutable derivation relationships connect an earlier CourseVersion
 * to a later CourseVersion while preserving historical identity.
 */
export {
  COURSE_VERSION_LINEAGE_RELATION,
  CourseVersionLineage,
} from './domain/versioning/course-version-lineage.js';

export type {
  CourseVersionLineageProps,
  CourseVersionLineageRelation,
  CreateCourseVersionLineageProps,
} from './domain/versioning/course-version-lineage.js';

/**
 * Course version rollback
 *
 * Rollback is modeled as creation of a new forward CourseVersion
 * derived from an immutable historical version.
 *
 * Historical versions are never mutated or reused.
 */
export { createCourseVersionRollback } from './domain/versioning/course-version-rollback.js';

export type {
  CreateCourseVersionRollbackProps,
  CourseVersionRollbackResult,
} from './domain/versioning/course-version-rollback.js';

/**
 * Course version history
 *
 * Provides an immutable, deterministic read-side representation of the
 * version history for a single Course.
 */
export { CourseVersionHistory } from './domain/versioning/course-version-history.js';

export type {
  CourseVersionHistoryEntry,
  CourseVersionHistoryProps,
} from './domain/versioning/course-version-history.js';

/**
 * Course version audit
 *
 * Immutable audit facts for CourseVersion operations.
 *
 * Audit semantics remain separate from the canonical Course domain-event
 * contracts: domain events describe transactional state changes, while
 * audit entries provide durable historical context such as actor, reason,
 * and operational metadata.
 */
export {
  COURSE_VERSION_AUDIT_ACTOR_TYPE,
  COURSE_VERSION_AUDIT_EVENT_TYPE,
  CourseVersionAudit,
  isCourseVersionAuditActorType,
  isCourseVersionAuditEventType,
  isValidCourseVersionAuditMetadataValue,
} from './domain/versioning/course-version-audit.js';

export type {
  CourseVersionAuditActor,
  CourseVersionAuditActorType,
  CourseVersionAuditEventType,
  CourseVersionAuditMetadata,
  CourseVersionAuditMetadataValue,
  CourseVersionAuditProps,
  CreateCourseVersionAuditProps,
} from './domain/versioning/course-version-audit.js';

/**
 * CourseVersion lifecycle status
 */
export {
  CourseVersionStatus,
  COURSE_VERSION_STATUSES,
  isCourseVersionStatus,
} from './domain/enums/course-version-status.js';

export type { CourseVersionStatus as CourseVersionStatusValue } from './domain/enums/course-version-status.js';

/**
 * Course repositories
 */
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
