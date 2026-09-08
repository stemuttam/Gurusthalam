export {
  createCourseCoreMetadata,
  createCourseDiscoveryMetadata,
  createCourseMetadata,
  createCourseTaxonomyMetadata,
} from './course-metadata.js';

export type {
  CourseCoreMetadata,
  CourseDiscoveryMetadata,
  CourseMetadata,
  CourseMetadataPatch,
  CourseTaxonomyMetadata,
} from './course-metadata.js';

export {
  createCategoryVocabularyEntry,
  createSkillVocabularyEntry,
  createSubcategoryVocabularyEntry,
  createSubjectVocabularyEntry,
  createTaxonomyVocabularyConcept,
  createTaxonomyVocabularyEntry,
  createTopicVocabularyEntry,
} from './taxonomy-vocabulary.js';

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
} from './taxonomy-vocabulary.js';

/**
 * Course discovery metadata primitives
 *
 * These contracts represent learner-facing discovery semantics while
 * remaining independent from persistence, HTTP, infrastructure, and
 * AI/ML implementation details.
 *
 * The CourseMetadata-level discovery factory remains owned by
 * course-metadata.ts. Discovery-specific value objects and semantic
 * structures are exported here without redefining that factory.
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
} from './discovery/index.js';

export type {
  CourseDifficultySignal,
  CourseDifficultySignals,
  DifficultyDimension,
  DifficultySignalStrength,
  FutureDiscoverySignal,
  LearningObjective,
} from './discovery/index.js';

/**
 * Course metadata validation and domain invariants
 *
 * This boundary validates the semantic integrity of an already constructed
 * CourseMetadata snapshot. It remains independent from persistence, HTTP,
 * infrastructure, and AI/ML implementation details.
 */
export {
  CourseMetadataValidationError,
  getCourseMetadataValidationIssues,
  isValidCourseMetadata,
  validateCourseMetadata,
} from './validation/index.js';

export type {
  CourseMetadataValidationIssue,
  CourseMetadataValidationPath,
} from './validation/index.js';
