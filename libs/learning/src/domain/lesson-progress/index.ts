export {
  LessonProgress,
  type CreateLessonProgressProps,
  type LessonProgressProps,
} from './lesson-progress.js';

export {
  LessonProgressDomainError,
  LessonProgressDomainErrorCode,
  LessonProgressValidationError,
  InvalidLessonProgressTransitionError,
  type LessonProgressValidationIssue,
} from './lesson-progress-error.js';

export {
  LessonProgressDomainEventName,
  createLessonProgressStartedEvent,
  createLessonProgressUpdatedEvent,
  createLessonProgressCompletedEvent,
  type LessonProgressDomainEvent,
  type LessonProgressEvent,
  type LessonProgressStartedEvent,
  type LessonProgressStartedPayload,
  type LessonProgressUpdatedEvent,
  type LessonProgressUpdatedPayload,
  type LessonProgressCompletedEvent,
  type LessonProgressCompletedPayload,
} from './lesson-progress-events.js';

export {
  LessonProgressStatus,
  LESSON_PROGRESS_STATUSES,
  isLessonProgressStatus,
  type LessonProgressStatus as LessonProgressStatusValue,
} from './lesson-progress-status.js';

export type { LessonProgressRepository } from './lesson-progress-repository.js';
