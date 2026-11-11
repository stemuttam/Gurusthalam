
import type {
  QuestionAssignment,
  QuestionAssignmentRole,
} from '../assignments/question-assignment.js';

export interface QuestionAssignmentActor {
  readonly principalId: string;
  readonly tenantId: string;
}

export interface GrantQuestionAssignmentCommand {
  readonly actor: QuestionAssignmentActor;
  readonly questionId: string;
  readonly principalId: string;
  readonly role: Exclude<QuestionAssignmentRole, 'OWNER'>;
}

export interface ChangeQuestionAssignmentRoleCommand {
  readonly actor: QuestionAssignmentActor;
  readonly questionId: string;
  readonly principalId: string;
  readonly role: Exclude<QuestionAssignmentRole, 'OWNER'>;
}

export interface RevokeQuestionAssignmentCommand {
  readonly actor: QuestionAssignmentActor;
  readonly questionId: string;
  readonly principalId: string;
}

export interface TransferQuestionOwnershipCommand {
  readonly actor: QuestionAssignmentActor;
  readonly questionId: string;
  readonly newOwnerPrincipalId: string;
}

export interface ListQuestionAssignmentsQuery {
  readonly actor: QuestionAssignmentActor;
  readonly questionId: string;
}

/**
 * Persistence contract for Question assignment administration.
 *
 * Every mutation MUST:
 * - execute in one database transaction;
 * - lock the tenant-scoped Question aggregate row before reading or
 *   mutating assignment rows;
 * - revalidate actor principal and active tenant membership;
 * - revalidate manager authority inside the transaction;
 * - validate the target's active principal and tenant membership;
 * - preserve the immutable Question.createdByPrincipalId;
 * - guarantee exactly one OWNER after a successful mutation.
 *
 * The list operation must also enforce manager authorization and tenant scope.
 */
export interface QuestionAssignmentRepository {
  grant(
    command: GrantQuestionAssignmentCommand,
  ): Promise<QuestionAssignment>;

  changeRole(
    command: ChangeQuestionAssignmentRoleCommand,
  ): Promise<QuestionAssignment>;

  revoke(
    command: RevokeQuestionAssignmentCommand,
  ): Promise<void>;

  list(
    query: ListQuestionAssignmentsQuery,
  ): Promise<readonly QuestionAssignment[]>;

  transferOwnership(
    command: TransferQuestionOwnershipCommand,
  ): Promise<readonly QuestionAssignment[]>;
}
