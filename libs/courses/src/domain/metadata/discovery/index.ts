export { AudienceReference } from './audience-reference.js';

export {
  createCourseDifficultySignal,
  createCourseDifficultySignals,
} from './difficulty-signals.js';

export type {
  CourseDifficultySignal,
  CourseDifficultySignals,
  DifficultyDimension,
  DifficultySignalStrength,
} from './difficulty-signals.js';

export {
  createFutureDiscoverySignal,
  isValidDiscoverySignalKey,
  isValidDiscoverySignalValue,
} from './future-discovery-signal.js';

export type { FutureDiscoverySignal } from './future-discovery-signal.js';

export {
  createLearningObjective,
  isValidLearningObjectiveStatement,
} from './learning-objective.js';

export type { LearningObjective } from './learning-objective.js';

export { LanguageCode } from './language-code.js';

export {
  createCourseDiscoveryMetadata,
} from './course-discovery-metadata.js';

export type {
  CourseDiscoveryMetadata,
  CourseDiscoveryMetadataInput,
} from './course-discovery-metadata.js';
