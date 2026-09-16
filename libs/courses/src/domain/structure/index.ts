export {
  LearningUnit,
  Section,
} from './entities/index.js';

export type {
  CreateLearningUnitProps,
  CreateSectionProps,
  LearningUnitProps,
  SectionProps,
} from './entities/index.js';

export {
  AssessmentReferenceId,
  ContentItemReferenceId,
  LearningUnitId,
  SectionId,
} from './identifiers/index.js';

export {
  createAssessmentReference,
  createContentItemReference,
  rehydrateAssessmentReference,
  rehydrateContentItemReference,
} from './references/index.js';

export type {
  AssessmentReferenceProps,
  ContentItemReferenceProps,
  CreateAssessmentReferenceProps,
  CreateContentItemReferenceProps,
} from './references/index.js';

export { CourseStructure } from './course-structure.js';

export type {
  CourseStructureProps,
  CreateCourseStructureProps,
  RehydrateCourseStructureProps,
} from './course-structure.js';