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
  SkillVocabularyEntry,
  SubcategoryVocabularyEntry,
  SubjectVocabularyEntry,
  TaxonomyConceptKind,
  TaxonomyVocabularyConcept,
  TaxonomyVocabularyEntry,
  CourseTaxonomyVocabularyReferences,
  TopicVocabularyEntry,
} from './taxonomy-vocabulary.js';
