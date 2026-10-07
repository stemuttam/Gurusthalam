export {
  LearningSession,
  type CreateLearningSessionProps,
  type LearningSessionProps,
} from './learning-session.js';

export {
  LearningSessionStatus,
  type LearningSessionStatus as LearningSessionStatusValue,
} from './learning-session-status.js';

export {
  LearningSessionDomainEventName,
  createLearningSessionAbandonedEvent,
  createLearningSessionCompletedEvent,
  createLearningSessionPausedEvent,
  createLearningSessionResumedEvent,
  createLearningSessionStartedEvent,
  type LearningSessionAbandonedEvent,
  type LearningSessionCompletedEvent,
  type LearningSessionDomainEvent,
  type LearningSessionEvent,
  type LearningSessionLifecyclePayload,
  type LearningSessionPausedEvent,
  type LearningSessionResumedEvent,
  type LearningSessionStartedEvent,
} from './learning-session-events.js';

export {
  LearningSessionDomainError,
  LearningSessionDomainErrorCode,
  LearningSessionValidationError,
  InvalidLearningSessionTransitionError,
  type LearningSessionValidationIssue,
} from './learning-session-error.js';

export type { LearningSessionRepository } from './learning-session-repository.js';