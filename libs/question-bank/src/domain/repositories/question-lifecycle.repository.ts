import type { QuestionDomainEvent } from '../events/question-domain-event.js';
import type { QuestionOwnership } from '../ownership/question-ownership.js';
import type { QuestionId } from '../identifiers/question-id.js';
import type { QuestionVersionId } from '../identifiers/question-version-id.js';
import type { QuestionVersionSnapshot } from '../versioning/question-version-snapshot.js';

/**
 * Atomic persistence command for the Question lifecycle.
 *
 * CREATE inserts a new Question identity and its first complete version.
 * APPEND inserts a new immutable version against an existing owned Question.
 * The adapter must persist the supplied domain event to the outbox in the
 * same database transaction as the Question/version rows.
 */
export type QuestionLifecycleWrite =
  | {
      readonly operation: 'CREATE';
      readonly snapshot: QuestionVersionSnapshot;
      readonly ownership: QuestionOwnership;
      readonly event: QuestionDomainEvent;
    }
  | {
      readonly operation: 'APPEND';
      readonly snapshot: QuestionVersionSnapshot;
      readonly ownership: QuestionOwnership;
      readonly expectedPreviousVersionId: QuestionVersionId;
      readonly event: QuestionDomainEvent;
    };

export interface QuestionLifecycleRepository {
  findLatest(
    tenantId: string,
    questionId: QuestionId,
  ): Promise<QuestionVersionSnapshot | null>;

  findVersion(
    tenantId: string,
    questionId: QuestionId,
    versionId: QuestionVersionId,
  ): Promise<QuestionVersionSnapshot | null>;

  /**
   * Must validate active principal/tenant membership, tenant ownership,
   * and expected predecessor inside the same transaction that persists
   * the snapshot and outbox event.
   *
   * Implementations must reject unassigned legacy Questions.
   */
  persist(command: QuestionLifecycleWrite): Promise<void>;
}
