import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../../prisma.service.js';

import {
  PrismaRepositoryError,
} from '../prisma-repository.error.js';

import { PrismaQuestionAssignmentRepository } from './prisma-question-assignment.repository.js';

const databaseAvailable = Boolean(process.env.DATABASE_URL);

const suitePrefix = `phase-5-14-h-assignment-${randomUUID()}`;

interface AssignmentActor {
  readonly principalId: string;
  readonly tenantId: string;
}

interface QuestionFixture {
  readonly questionId: string;
  readonly actor: AssignmentActor;
}

describe.skipIf(!databaseAvailable)(
  'PrismaQuestionAssignmentRepository - PostgreSQL concurrency and isolation evidence',
  () => {
    let prisma: PrismaService | undefined;
    let repository: PrismaQuestionAssignmentRepository;

    let tenantId: string | undefined;

    let ownerPrincipalId: string;
    let contenderAId: string;
    let contenderBId: string;
    let grantTargetAId: string;
    let grantTargetBId: string;
    let duplicateTargetId: string;

    const principalIds: string[] = [];

    const requirePrisma = (): PrismaService => {
      if (prisma === undefined) {
        throw new Error(
          'PostgreSQL concurrency integration database was not initialized.',
        );
      }

      return prisma;
    };

    const actor = (principalId: string): AssignmentActor => {
      if (tenantId === undefined) {
        throw new Error('The PostgreSQL test tenant was not initialized.');
      }

      return {
        principalId,
        tenantId,
      };
    };

    const createQuestionFixture = async (
      label: string,
    ): Promise<QuestionFixture> => {
      if (tenantId === undefined) {
        throw new Error('The PostgreSQL test tenant was not initialized.');
      }

      const questionId = `${suitePrefix}-${label}-question`;

      await requirePrisma().question.create({
        data: {
          id: questionId,
          tenantId,
          createdByPrincipalId: ownerPrincipalId,
        },
      });

      await requirePrisma().questionAssignment.create({
        data: {
          questionId,
          tenantId,
          principalId: ownerPrincipalId,
          role: 'OWNER',
          assignedByPrincipalId: ownerPrincipalId,
        },
      });

      return {
        questionId,
        actor: actor(ownerPrincipalId),
      };
    };

    const findAssignment = async (
      questionId: string,
      principalId: string,
    ) => {
      return requirePrisma().questionAssignment.findUnique({
        where: {
          questionId_principalId: {
            questionId,
            principalId,
          },
        },
      });
    };

    const findAssignments = async (questionId: string) => {
      if (tenantId === undefined) {
        throw new Error('The PostgreSQL test tenant was not initialized.');
      }

      return requirePrisma().questionAssignment.findMany({
        where: {
          questionId,
          tenantId,
        },
        orderBy: [
          { role: 'asc' },
          { principalId: 'asc' },
        ],
      });
    };

    const expectExactlyOneOwner = async (
      questionId: string,
    ): Promise<string> => {
      const assignments = await findAssignments(questionId);

      const owners = assignments.filter(
        (assignment) => assignment.role === 'OWNER',
      );

      expect(owners).toHaveLength(1);

      const owner = owners[0];

      if (owner === undefined) {
        throw new Error(
          'The Question does not have a persisted OWNER assignment.',
        );
      }

      return owner.principalId;
    };

    const expectRepositoryErrors = (
      results: PromiseSettledResult<unknown>[],
    ): void => {
      const rejected = results.filter(
        (result) => result.status === 'rejected',
      );

      for (const result of rejected) {
        if (result.status !== 'rejected') {
          throw new Error('Expected a rejected repository operation.');
        }

        expect(result.reason).toBeInstanceOf(PrismaRepositoryError);
      }
    };

    beforeAll(async () => {
      const database = new PrismaService();

      prisma = database;

      await database.$connect();

      tenantId = `${suitePrefix}-tenant`;

      ownerPrincipalId = `${suitePrefix}-owner`;
      contenderAId = `${suitePrefix}-contender-a`;
      contenderBId = `${suitePrefix}-contender-b`;
      grantTargetAId = `${suitePrefix}-grant-target-a`;
      grantTargetBId = `${suitePrefix}-grant-target-b`;
      duplicateTargetId = `${suitePrefix}-duplicate-target`;

      principalIds.push(
        ownerPrincipalId,
        contenderAId,
        contenderBId,
        grantTargetAId,
        grantTargetBId,
        duplicateTargetId,
      );

      await requirePrisma().tenant.create({
        data: {
          id: tenantId,
          slug: `${suitePrefix}-tenant`,
          name: 'Question assignment concurrency integration tenant',
          auth0OrganizationId: `${suitePrefix}-auth0-org`,
        },
      });

      await requirePrisma().authPrincipal.createMany({
        data: principalIds.map((id) => ({
          id,
        })),
      });

      await requirePrisma().principalTenantMembership.createMany({
        data: principalIds.map((principalId) => ({
          principalId,
          tenantId: tenantId as string,
          roles: ['teacher'],
          timezone: 'UTC',
        })),
      });

      repository = new PrismaQuestionAssignmentRepository(database);
    });

    afterAll(async () => {
      if (prisma === undefined) {
        return;
      }

      try {
        if (tenantId !== undefined) {
          // Delete only fixtures created by this test suite.
          await prisma.questionAssignment.deleteMany({
            where: {
              questionId: {
                startsWith: suitePrefix,
              },
            },
          });

          await prisma.question.deleteMany({
            where: {
              id: {
                startsWith: suitePrefix,
              },
            },
          });

          await prisma.principalTenantMembership.deleteMany({
            where: {
              tenantId,
            },
          });
        }

        if (principalIds.length > 0) {
          await prisma.authPrincipal.deleteMany({
            where: {
              id: {
                in: principalIds,
              },
            },
          });
        }

        if (tenantId !== undefined) {
          await prisma.tenant.deleteMany({
            where: {
              id: tenantId,
            },
          });
        }
      } finally {
        await prisma.$disconnect();
        prisma = undefined;
      }
    });

    it(
      'allows exactly one competing ownership transfer to commit and preserves the single-OWNER invariant',
      async () => {
        const fixture = await createQuestionFixture(
          'competing-ownership-transfers',
        );

        const results = await Promise.allSettled([
          repository.transferOwnership({
            actor: fixture.actor,
            questionId: fixture.questionId,
            newOwnerPrincipalId: contenderAId,
          }),

          repository.transferOwnership({
            actor: fixture.actor,
            questionId: fixture.questionId,
            newOwnerPrincipalId: contenderBId,
          }),
        ]);

        const fulfilled = results.filter(
          (result) => result.status === 'fulfilled',
        );

        const rejected = results.filter(
          (result) => result.status === 'rejected',
        );

        // Both transactions start from the same original OWNER state.
        // Only one ownership transfer may commit.
        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);

        expectRepositoryErrors(results);

        const persistedOwnerId = await expectExactlyOneOwner(
          fixture.questionId,
        );

        expect(
          [contenderAId, contenderBId].includes(persistedOwnerId),
        ).toBe(true);

        const [question, formerOwner] = await Promise.all([
          requirePrisma().question.findUnique({
            where: {
              id: fixture.questionId,
            },
          }),

          findAssignment(
            fixture.questionId,
            ownerPrincipalId,
          ),
        ]);

        // Ownership transfer must never rewrite creator provenance.
        expect(question?.createdByPrincipalId).toBe(ownerPrincipalId);

        // The original owner is demoted atomically.
        expect(formerOwner?.role).toBe('EDITOR');

        // The losing contender must not become an additional OWNER.
        const assignments = await findAssignments(
          fixture.questionId,
        );

        expect(
          assignments.filter(
            (assignment) => assignment.role === 'OWNER',
          ),
        ).toHaveLength(1);
      },
    );

    it(
      'serializes concurrent grants to different principals without losing either committed assignment',
      async () => {
        const fixture = await createQuestionFixture(
          'concurrent-distinct-grants',
        );

        const results = await Promise.allSettled([
          repository.grant({
            actor: fixture.actor,
            questionId: fixture.questionId,
            principalId: grantTargetAId,
            role: 'AUTHOR',
          }),

          repository.grant({
            actor: fixture.actor,
            questionId: fixture.questionId,
            principalId: grantTargetBId,
            role: 'EDITOR',
          }),
        ]);

        const fulfilled = results.filter(
          (result) => result.status === 'fulfilled',
        );

        const rejected = results.filter(
          (result) => result.status === 'rejected',
        );

        // Distinct assignments are both valid. The shared aggregate lock
        // must serialize the operations without losing either write.
        expect(fulfilled).toHaveLength(2);
        expect(rejected).toHaveLength(0);

        const [author, editor] = await Promise.all([
          findAssignment(
            fixture.questionId,
            grantTargetAId,
          ),

          findAssignment(
            fixture.questionId,
            grantTargetBId,
          ),
        ]);

        expect(author).toMatchObject({
          principalId: grantTargetAId,
          role: 'AUTHOR',
          assignedByPrincipalId: ownerPrincipalId,
        });

        expect(editor).toMatchObject({
          principalId: grantTargetBId,
          role: 'EDITOR',
          assignedByPrincipalId: ownerPrincipalId,
        });

        const persistedOwnerId = await expectExactlyOneOwner(
          fixture.questionId,
        );

        expect(persistedOwnerId).toBe(ownerPrincipalId);

        const question = await requirePrisma().question.findUnique({
          where: {
            id: fixture.questionId,
          },
        });

        expect(question?.createdByPrincipalId).toBe(ownerPrincipalId);
      },
    );

    it(
      'allows only one concurrent grant for the same principal and leaves no duplicate or partial assignment',
      async () => {
        const fixture = await createQuestionFixture(
          'concurrent-duplicate-grants',
        );

        const results = await Promise.allSettled([
          repository.grant({
            actor: fixture.actor,
            questionId: fixture.questionId,
            principalId: duplicateTargetId,
            role: 'AUTHOR',
          }),

          repository.grant({
            actor: fixture.actor,
            questionId: fixture.questionId,
            principalId: duplicateTargetId,
            role: 'EDITOR',
          }),
        ]);

        const fulfilled = results.filter(
          (result) => result.status === 'fulfilled',
        );

        const rejected = results.filter(
          (result) => result.status === 'rejected',
        );

        // The composite database primary key and repository transaction
        // boundary must prevent duplicate assignment creation.
        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);

        expectRepositoryErrors(results);

        const persisted = await findAssignment(
          fixture.questionId,
          duplicateTargetId,
        );

        expect(persisted).not.toBeNull();

        expect(
          ['AUTHOR', 'EDITOR'].includes(persisted?.role ?? ''),
        ).toBe(true);

        const assignments = await findAssignments(
          fixture.questionId,
        );

        expect(
          assignments.filter(
            (assignment) =>
              assignment.principalId === duplicateTargetId,
          ),
        ).toHaveLength(1);

        const persistedOwnerId = await expectExactlyOneOwner(
          fixture.questionId,
        );

        expect(persistedOwnerId).toBe(ownerPrincipalId);

        const question = await requirePrisma().question.findUnique({
          where: {
            id: fixture.questionId,
          },
        });

        expect(question?.createdByPrincipalId).toBe(ownerPrincipalId);
      },
    );
  },
);