
import {
  QuestionAssignment,
  type QuestionAssignmentRepository,
  type GrantQuestionAssignmentCommand,
  type ChangeQuestionAssignmentRoleCommand,
  type RevokeQuestionAssignmentCommand,
  type ListQuestionAssignmentsQuery,
  type TransferQuestionOwnershipCommand,
} from '@gurusthalam/question-bank';

import {
  Prisma,
  type PrismaClient,
} from '@gurusthalam/database';

import {
  withPrismaRepositoryErrorBoundary,
} from '../prisma-repository-error.mapper.js';

import {
  PrismaRepositoryError,
  PrismaRepositoryErrorCode,
} from '../prisma-repository.error.js';

const MANAGER_TENANT_ROLES = [
  'question_bank_admin',
  'tenant_admin',
] as const;

const ASSIGNABLE_ROLES = [
  'AUTHOR',
  'CO_AUTHOR',
  'EDITOR',
] as const;

type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

type AssignmentRecord = {
  questionId: string;
  tenantId: string;
  principalId: string;
  role: 'OWNER' | 'AUTHOR' | 'CO_AUTHOR' | 'EDITOR';
  assignedByPrincipalId: string;
  createdAt: Date;
  updatedAt: Date;
};

type LockedQuestion = {
  id: string;
  tenantId: string | null;
  createdByPrincipalId: string | null;
};

type ActiveMembership = {
  principalId: string;
  roles: string[];
};

function isAssignableRole(role: string): role is AssignableRole {
  return (ASSIGNABLE_ROLES as readonly string[]).includes(role);
}

function assertIdentifier(value: string, field: string): void {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.trim() !== value
  ) {
    throw new PrismaRepositoryError(
      `Invalid ${field}.`,
      PrismaRepositoryErrorCode.RECORD_NOT_FOUND,
    );
  }
}

function toDomain(record: AssignmentRecord): QuestionAssignment {
  return QuestionAssignment.create({
    questionId: record.questionId,
    tenantId: record.tenantId,
    principalId: record.principalId,
    role: record.role,
    assignedByPrincipalId: record.assignedByPrincipalId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

/**
 * PostgreSQL-backed Question assignment repository.
 *
 * Concurrency contract:
 * - Every mutation locks the Question aggregate row first.
 * - Question lifecycle APPEND operations acquire the same row lock.
 * - All writes execute in Serializable transactions.
 * - Ownership transfer is atomic and preserves exactly one OWNER.
 *
 * Authorization is repeated inside the transaction. Callers must not
 * treat controller-level authorization as a replacement for these checks.
 */
export class PrismaQuestionAssignmentRepository
  implements QuestionAssignmentRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async grant(
    command: GrantQuestionAssignmentCommand,
  ): Promise<QuestionAssignment> {
    return withPrismaRepositoryErrorBoundary(
      'QuestionAssignmentRepository.grant',
      async () =>
        this.prisma.$transaction(
          async (transaction) => {
            const question = await this.lockQuestion(
              transaction,
              command.actor.tenantId,
              command.questionId,
            );

            await this.assertAssignmentManager(
              transaction,
              command.actor.principalId,
              command.actor.tenantId,
              command.questionId,
            );

            this.assertCreatorIntegrity(question);

            if (!isAssignableRole(command.role)) {
              throw this.authorizationError(
                'OWNER assignments can only be created through Question creation or ownership transfer.',
              );
            }

            await this.assertActiveMembership(
              transaction,
              command.principalId,
              command.actor.tenantId,
            );

            const existing = await transaction.questionAssignment.findUnique({
              where: {
                questionId_principalId: {
                  questionId: command.questionId,
                  principalId: command.principalId,
                },
              },
            });

            if (existing !== null) {
              throw new PrismaRepositoryError(
                'The principal already has an assignment for this Question.',
                PrismaRepositoryErrorCode.UNIQUE_CONSTRAINT,
              );
            }

            const now = new Date();

            const created = await transaction.questionAssignment.create({
              data: {
                questionId: command.questionId,
                tenantId: command.actor.tenantId,
                principalId: command.principalId,
                role: command.role,
                assignedByPrincipalId: command.actor.principalId,
                createdAt: now,
                updatedAt: now,
              },
            });

            return toDomain(created as AssignmentRecord);
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        ),
    );
  }

  async changeRole(
    command: ChangeQuestionAssignmentRoleCommand,
  ): Promise<QuestionAssignment> {
    return withPrismaRepositoryErrorBoundary(
      'QuestionAssignmentRepository.changeRole',
      async () =>
        this.prisma.$transaction(
          async (transaction) => {
            const question = await this.lockQuestion(
              transaction,
              command.actor.tenantId,
              command.questionId,
            );

            await this.assertAssignmentManager(
              transaction,
              command.actor.principalId,
              command.actor.tenantId,
              command.questionId,
            );

            this.assertCreatorIntegrity(question);

            if (!isAssignableRole(command.role)) {
              throw this.authorizationError(
                'The OWNER role cannot be assigned through changeRole.',
              );
            }

            const existing = await transaction.questionAssignment.findUnique({
              where: {
                questionId_principalId: {
                  questionId: command.questionId,
                  principalId: command.principalId,
                },
              },
            });

            if (existing === null || existing.tenantId !== command.actor.tenantId) {
              throw this.notFoundError();
            }

            if (existing.role === 'OWNER') {
              throw this.authorizationError(
                'The current OWNER role can only be changed through ownership transfer.',
              );
            }

            await this.assertActiveMembership(
              transaction,
              command.principalId,
              command.actor.tenantId,
            );

            const updated = await transaction.questionAssignment.update({
              where: {
                questionId_principalId: {
                  questionId: command.questionId,
                  principalId: command.principalId,
                },
              },
              data: {
                role: command.role,
                assignedByPrincipalId: command.actor.principalId,
                updatedAt: new Date(),
              },
            });

            return toDomain(updated as AssignmentRecord);
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        ),
    );
  }

  async revoke(
    command: RevokeQuestionAssignmentCommand,
  ): Promise<void> {
    await withPrismaRepositoryErrorBoundary(
      'QuestionAssignmentRepository.revoke',
      async () =>
        this.prisma.$transaction(
          async (transaction) => {
            const question = await this.lockQuestion(
              transaction,
              command.actor.tenantId,
              command.questionId,
            );

            await this.assertAssignmentManager(
              transaction,
              command.actor.principalId,
              command.actor.tenantId,
              command.questionId,
            );

            this.assertCreatorIntegrity(question);

            const existing = await transaction.questionAssignment.findUnique({
              where: {
                questionId_principalId: {
                  questionId: command.questionId,
                  principalId: command.principalId,
                },
              },
            });

            if (existing === null || existing.tenantId !== command.actor.tenantId) {
              throw this.notFoundError();
            }

            if (existing.role === 'OWNER') {
              throw this.authorizationError(
                'The OWNER assignment cannot be revoked. Transfer ownership first.',
              );
            }

            await transaction.questionAssignment.delete({
              where: {
                questionId_principalId: {
                  questionId: command.questionId,
                  principalId: command.principalId,
                },
              },
            });
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        ),
    );
  }

  async list(
    query: ListQuestionAssignmentsQuery,
  ): Promise<readonly QuestionAssignment[]> {
    return withPrismaRepositoryErrorBoundary(
      'QuestionAssignmentRepository.list',
      async () =>
        this.prisma.$transaction(
          async (transaction) => {
            const question = await transaction.question.findFirst({
              where: {
                id: query.questionId,
                tenantId: query.actor.tenantId,
                createdByPrincipalId: { not: null },
              },
              select: {
                id: true,
                tenantId: true,
                createdByPrincipalId: true,
              },
            });

            if (
              question === null ||
              question.tenantId !== query.actor.tenantId ||
              question.createdByPrincipalId === null
            ) {
              throw this.notFoundError();
            }

            await this.assertAssignmentManager(
              transaction,
              query.actor.principalId,
              query.actor.tenantId,
              query.questionId,
            );

            const records = await transaction.questionAssignment.findMany({
              where: {
                questionId: query.questionId,
                tenantId: query.actor.tenantId,
              },
              orderBy: [
                { role: 'asc' },
                { createdAt: 'asc' },
                { principalId: 'asc' },
              ],
            });

            return records.map((record) =>
              toDomain(record as AssignmentRecord),
            );
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            },
        ),
    );
  }

  async transferOwnership(
    command: TransferQuestionOwnershipCommand,
  ): Promise<readonly QuestionAssignment[]> {
    return withPrismaRepositoryErrorBoundary(
      'QuestionAssignmentRepository.transferOwnership',
      async () =>
        this.prisma.$transaction(
          async (transaction) => {
            const question = await this.lockQuestion(
              transaction,
              command.actor.tenantId,
              command.questionId,
            );

            await this.assertAssignmentManager(
              transaction,
              command.actor.principalId,
              command.actor.tenantId,
              command.questionId,
            );

            this.assertCreatorIntegrity(question);

            await this.assertActiveMembership(
              transaction,
              command.newOwnerPrincipalId,
              command.actor.tenantId,
            );

            const currentOwner =
              await transaction.questionAssignment.findFirst({
                where: {
                  questionId: command.questionId,
                  tenantId: command.actor.tenantId,
                  role: 'OWNER',
                },
              });

            if (currentOwner === null) {
              throw new PrismaRepositoryError(
                'The Question has no valid OWNER assignment.',
                PrismaRepositoryErrorCode.RECORD_NOT_FOUND,
              );
            }

            if (currentOwner.principalId === command.newOwnerPrincipalId) {
              throw new PrismaRepositoryError(
                'The requested principal is already the Question OWNER.',
                PrismaRepositoryErrorCode.UNIQUE_CONSTRAINT,
              );
            }

            const target =
              await transaction.questionAssignment.findUnique({
                where: {
                  questionId_principalId: {
                    questionId: command.questionId,
                    principalId: command.newOwnerPrincipalId,
                  },
                },
              });

            const now = new Date();

            // Demote the existing owner before promoting the target.
            // Both writes are in one transaction and are invisible until
            // commit. A failed promotion rolls the demotion back.
            await transaction.questionAssignment.update({
              where: {
                questionId_principalId: {
                  questionId: command.questionId,
                  principalId: currentOwner.principalId,
                },
              },
              data: {
                role: 'EDITOR',
                assignedByPrincipalId: command.actor.principalId,
                updatedAt: now,
              },
            });

            if (target === null) {
              await transaction.questionAssignment.create({
                data: {
                  questionId: command.questionId,
                  tenantId: command.actor.tenantId,
                  principalId: command.newOwnerPrincipalId,
                  role: 'OWNER',
                  assignedByPrincipalId: command.actor.principalId,
                  createdAt: now,
                  updatedAt: now,
                },
              });
            } else {
              if (target.tenantId !== command.actor.tenantId) {
                throw this.notFoundError();
              }

              await transaction.questionAssignment.update({
                where: {
                  questionId_principalId: {
                    questionId: command.questionId,
                    principalId: command.newOwnerPrincipalId,
                  },
                },
                data: {
                  role: 'OWNER',
                  assignedByPrincipalId: command.actor.principalId,
                  updatedAt: now,
                },
              });
            }

            const records =
              await transaction.questionAssignment.findMany({
                where: {
                  questionId: command.questionId,
                  tenantId: command.actor.tenantId,
                },
                orderBy: [
                  { role: 'asc' },
                  { createdAt: 'asc' },
                  { principalId: 'asc' },
                ],
              });

            // The original Question.createdByPrincipalId is deliberately
            // not modified during ownership transfer.
            return records.map((record) =>
              toDomain(record as AssignmentRecord),
            );
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        ),
    );
  }

  private async lockQuestion(
    transaction: Prisma.TransactionClient,
    tenantId: string,
    questionId: string,
  ): Promise<LockedQuestion> {
    assertIdentifier(tenantId, 'tenantId');
    assertIdentifier(questionId, 'questionId');

    const rows = await transaction.$queryRaw<LockedQuestion[]>`
      SELECT
        "id",
        "tenantId",
        "createdByPrincipalId"
      FROM "Question"
      WHERE "id" = ${questionId}
        AND "tenantId" = ${tenantId}
      FOR UPDATE
    `;

    const question = rows[0];

    if (
      question === undefined ||
      question.tenantId !== tenantId ||
      question.createdByPrincipalId === null
    ) {
      throw this.notFoundError();
    }

    return question;
  }

  private async assertAssignmentManager(
    transaction: Prisma.TransactionClient,
    actorPrincipalId: string,
    tenantId: string,
    questionId: string,
  ): Promise<void> {
    const membership = await this.getActiveMembership(
      transaction,
      actorPrincipalId,
      tenantId,
    );

    const hasTenantManagerRole = membership.roles.some((role) =>
      (MANAGER_TENANT_ROLES as readonly string[]).includes(role),
    );

    if (hasTenantManagerRole) {
      return;
    }

    const ownerAssignment =
      await transaction.questionAssignment.findFirst({
        where: {
          questionId,
          tenantId,
          principalId: actorPrincipalId,
          role: 'OWNER',
        },
        select: { principalId: true },
      });

    if (ownerAssignment === null) {
      throw this.authorizationError(
        'The principal cannot manage assignments for this Question.',
      );
    }
  }

  private async assertActiveMembership(
    transaction: Prisma.TransactionClient,
    principalId: string,
    tenantId: string,
  ): Promise<void> {
    await this.getActiveMembership(
      transaction,
      principalId,
      tenantId,
    );
  }

  private async getActiveMembership(
    transaction: Prisma.TransactionClient,
    principalId: string,
    tenantId: string,
  ): Promise<ActiveMembership> {
    assertIdentifier(principalId, 'principalId');
    assertIdentifier(tenantId, 'tenantId');

    const membership =
      await transaction.principalTenantMembership.findFirst({
        where: {
          principalId,
          tenantId,
          status: 'ACTIVE',
          principal: {
            is: {
              status: 'ACTIVE',
            },
          },
          tenant: {
            is: {
              status: 'ACTIVE',
            },
          },
        },
        select: {
          principalId: true,
          roles: true,
        },
      });

    if (membership === null) {
      throw this.authorizationError(
        'An active principal and tenant membership are required.',
      );
    }

    return membership;
  }

  private assertCreatorIntegrity(question: LockedQuestion): void {
    if (
      question.id.length === 0 ||
      question.tenantId === null ||
      question.createdByPrincipalId === null
    ) {
      throw this.notFoundError();
    }
  }

  private authorizationError(message: string): PrismaRepositoryError {
    return new PrismaRepositoryError(
      message,
      PrismaRepositoryErrorCode.AUTHORIZATION_DENIED,
    );
  }

  private notFoundError(): PrismaRepositoryError {
    return new PrismaRepositoryError(
      'The Question or assignment was not found in the authenticated tenant.',
      PrismaRepositoryErrorCode.RECORD_NOT_FOUND,
    );
  }
}
