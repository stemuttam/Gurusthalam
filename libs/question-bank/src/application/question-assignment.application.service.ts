
import type {
  QuestionAssignment,
  QuestionAssignmentRepository,
} from '../domain/index.js';

import type {
  ChangeQuestionAssignmentRoleCommand,
  GrantQuestionAssignmentCommand,
  QuestionAssignmentActor,
  RevokeQuestionAssignmentCommand,
  TransferQuestionOwnershipCommand,
  ListQuestionAssignmentsQuery,
} from '../domain/index.js';

export class QuestionAssignmentApplicationService {
  constructor(
    private readonly repository: QuestionAssignmentRepository,
  ) {}

  async grant(
    actor: QuestionAssignmentActor,
    questionId: string,
    principalId: string,
    role: GrantQuestionAssignmentCommand['role'],
  ): Promise<QuestionAssignment> {
    const command: GrantQuestionAssignmentCommand = {
      actor: validateActor(actor),
      questionId: validateIdentifier(questionId, 'questionId'),
      principalId: validateIdentifier(principalId, 'principalId'),
      role: validateNonOwnerRole(role),
    };

    if (command.actor.principalId === command.principalId) {
      throw new QuestionAssignmentValidationError(
        'A manager cannot grant a collaboration assignment to themselves.',
      );
    }

    return this.repository.grant(command);
  }

  async changeRole(
    actor: QuestionAssignmentActor,
    questionId: string,
    principalId: string,
    role: ChangeQuestionAssignmentRoleCommand['role'],
  ): Promise<QuestionAssignment> {
    const command: ChangeQuestionAssignmentRoleCommand = {
      actor: validateActor(actor),
      questionId: validateIdentifier(questionId, 'questionId'),
      principalId: validateIdentifier(principalId, 'principalId'),
      role: validateNonOwnerRole(role),
    };

    if (command.actor.principalId === command.principalId) {
      throw new QuestionAssignmentValidationError(
        'A manager cannot change their own Question assignment.',
      );
    }

    return this.repository.changeRole(command);
  }

  async revoke(
    actor: QuestionAssignmentActor,
    questionId: string,
    principalId: string,
  ): Promise<void> {
    const command: RevokeQuestionAssignmentCommand = {
      actor: validateActor(actor),
      questionId: validateIdentifier(questionId, 'questionId'),
      principalId: validateIdentifier(principalId, 'principalId'),
    };

    if (command.actor.principalId === command.principalId) {
      throw new QuestionAssignmentValidationError(
        'A manager cannot revoke their own Question assignment.',
      );
    }

    await this.repository.revoke(command);
  }

  async list(
    actor: QuestionAssignmentActor,
    questionId: string,
  ): Promise<readonly QuestionAssignment[]> {
    const query: ListQuestionAssignmentsQuery = {
      actor: validateActor(actor),
      questionId: validateIdentifier(questionId, 'questionId'),
    };

    return this.repository.list(query);
  }

  async transferOwnership(
    actor: QuestionAssignmentActor,
    questionId: string,
    newOwnerPrincipalId: string,
  ): Promise<readonly QuestionAssignment[]> {
    const command: TransferQuestionOwnershipCommand = {
      actor: validateActor(actor),
      questionId: validateIdentifier(questionId, 'questionId'),
      newOwnerPrincipalId: validateIdentifier(
        newOwnerPrincipalId,
        'newOwnerPrincipalId',
      ),
    };

    if (command.actor.principalId === command.newOwnerPrincipalId) {
      throw new QuestionAssignmentValidationError(
        'The current actor is already the proposed new owner.',
      );
    }

    return this.repository.transferOwnership(command);
  }
}

function validateActor(
  actor: QuestionAssignmentActor,
): QuestionAssignmentActor {
  if (actor === null || typeof actor !== 'object') {
    throw new QuestionAssignmentAuthenticationError(
      'An authenticated principal and tenant are required.',
    );
  }

  return Object.freeze({
    principalId: validateIdentifier(actor.principalId, 'principalId'),
    tenantId: validateIdentifier(actor.tenantId, 'tenantId'),
  });
}

function validateIdentifier(value: string, field: string): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.trim() !== value
  ) {
    throw new QuestionAssignmentValidationError(
      `${field} must be a non-empty canonical identifier.`,
    );
  }

  return value;
}

function validateNonOwnerRole(
  role: string,
): Exclude<
  import('../domain/index.js').QuestionAssignmentRole,
  'OWNER'
> {
  if (
    role !== 'AUTHOR' &&
    role !== 'CO_AUTHOR' &&
    role !== 'EDITOR'
  ) {
    throw new QuestionAssignmentValidationError(
      'The OWNER role can only be established through ownership transfer.',
    );
  }

  return role;
}

export class QuestionAssignmentAuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuestionAssignmentAuthenticationError';
  }
}

export class QuestionAssignmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuestionAssignmentValidationError';
  }
}
