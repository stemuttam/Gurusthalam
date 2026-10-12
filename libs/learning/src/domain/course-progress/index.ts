export {
  calculateCourseProgress,
  CourseProgressAggregationValidationError,
  CourseProgressSourceStatus,
} from './course-progress-aggregation.policy.js';

export type {
  CalculateCourseProgressInput,
  CourseProgressAggregationIssue,
  CourseProgressAggregationResult,
  CourseProgressLearningUnit,
  CourseProgressLessonState,
  CourseProgressSourceStatus as CourseProgressSourceStatusValue,
} from './course-progress-aggregation.policy.js';

export {
  createCourseProgressReadModel,
  CourseProgressReadModelValidationError,
} from './course-progress.read-model.js';

export type {
  CreateCourseProgressReadModelInput,
  CourseProgressReadModel,
  CourseProgressReadModelIssue,
} from './course-progress.read-model.js';
