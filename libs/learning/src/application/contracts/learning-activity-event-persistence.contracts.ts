import type { ValidatedLearningActivityEvent } from '../../domain/learning-activity-event/index.js';

/**
 * Result of durably recording a validated learning activity occurrence.
 *
 * "duplicate" means the eventId already existed and its canonical event
 * payload matched the incoming occurrence. It does not mean a second
 * activity was created.
 */
export type LearningActivityEventPersistenceResult =
  | {
      readonly status: 'created';
    }
  | {
      readonly status: 'duplicate';
    };

/**
 * Application-facing persistence port for durable learner activity history.
 *
 * Implementations must enforce event identity atomically at the persistence
 * boundary. Callers must supply a validated event with a stable eventId.
 */
export interface LearningActivityEventRepository {
  record(
    event: ValidatedLearningActivityEvent,
  ): Promise<LearningActivityEventPersistenceResult>;
}

/**
 * Raised when an eventId already belongs to a different activity occurrence.
 *
 * Reusing an eventId with different content is not a successful retry and
 * must not overwrite the previously persisted occurrence.
 */
export class LearningActivityEventIdentityConflictError extends Error {
  readonly eventId: string;

  constructor(eventId: string) {
    super(
      `Learning activity eventId "${eventId}" already exists with different content.`,
    );

    this.name = 'LearningActivityEventIdentityConflictError';
    this.eventId = eventId;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}
