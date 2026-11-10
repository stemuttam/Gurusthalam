
import type { QuestionDomainEvent } from '../events/question-domain-event.js';
import type { QuestionOwnership } from '../ownership/question-ownership.js';
import type { QuestionId } from '../identifiers/question-id.js';
import type { QuestionVersionId } from '../identifiers/question-version-id.js';
import type { QuestionVersionSnapshot } from '../versioning/question-version-snapshot.js';

/**
 * Atomic persistence command for the Question lifecycle.
 *
 * ownership is immutable creator ownership. actorPrincipalId is the
 * authenticated principal performing this specific operation.
 */
export type QuestionLifecycleWrite =
  | {
      readonly operation: 'CREATE';
      readonly snapshot: QuestionVersionSnapshot;
      readonly ownership: QuestionOwnership;
      readonly actorPrincipalId: string;
      readonly event: QuestionDomainEvent;
    }
  | {
      readonly operation: 'APPEND';
      readonly snapshot: QuestionVersionSnapshot;
      readonly ownership: QuestionOwnership;
      readonly actorPrincipalId: string;
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
   * Returns the immutable creator ownership for a tenant-scoped Question.
   * Returns null for a missing, cross-tenant, or unassigned legacy Question.
   */
  findOwnership(
    tenantId: string,
    questionId: QuestionId,
  ): Promise<QuestionOwnership | null>;

  /**
   * The persistence adapter must revalidate the actor's active principal,
   * tenant membership, tenant role and Question assignment inside the same
   * transaction that writes the snapshot and outbox event.
   *
   * CREATE must atomically create the Question's OWNER assignment.
   * APPEND must preserve the original creator ownership.
   * Unassigned legacy Questions must not be modified through this lifecycle.
   */
  persist(command: QuestionLifecycleWrite): Promise<void>;
}
