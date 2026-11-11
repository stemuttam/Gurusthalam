import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../../prisma.service.js';
import { PrismaQuestionAssignmentRepository } from './prisma-question-assignment.repository.js';

const databaseAvailable = Boolean(process.env.DATABASE_URL);

const suitePrefix = `phase-5-14-g-assignment-${randomUUID()}`;

type AssignmentActor = {
  principalId: string;
  tenantId: string;
};

type QuestionFixture = {
  questionId: string;
  tenantId: string;
  ownerPrincipalId: string;
  actor: AssignmentActor;
};

describe.skipIf(!databaseAvailable)(
  'PrismaQuestionAssignmentRepository - PostgreSQL integration',
  () => {
    let prisma: PrismaService | undefined;
    let repository: PrismaQuestionAssignmentRepository;

    let tenantId: string;
    let otherTenantId: string;

    let ownerPrincipalId: string;
    let tenantAdminPrincipalId: string;
    let authorPrincipalId: string;
    let editorPrincipalId: string;
    let ordinaryTeacherPrincipalId: string;
    let crossTenantPrincipalId: string;
    let suspendedPrincipalId: string;

    const requirePrisma = (): PrismaService => {
      if (prisma === undefined) {
        throw new Error('PostgreSQL integration database was not initialized.');
      }

      return prisma;
    };

    const actor = (principalId: string): AssignmentActor => ({
      principalId,
      tenantId,
    });

    const createQuestionFixture = async (
      suffix: string,
    ): Promise<QuestionFixture> => {
      const questionId = `${suitePrefix}-${suffix}-question`;

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
        tenantId,
        ownerPrincipalId,
        actor: actor(ownerPrincipalId),
      };
    };

    const findAssignment = async (questionId: string, principalId: string) =>
      requirePrisma().questionAssignment.findUnique({
        where: {
          questionId_principalId: {
            questionId,
            principalId,
          },
        },
      });

    const findAssignments = async (questionId: string) =>
      requirePrisma().questionAssignment.findMany({
        where: {
          questionId,
          tenantId,
        },
        orderBy: [{ role: 'asc' }, { principalId: 'asc' }],
      });

    beforeAll(async () => {
      const database = new PrismaService();
      prisma = database;

      await database.$connect();

      tenantId = `${suitePrefix}-tenant`;
      otherTenantId = `${suitePrefix}-other-tenant`;

      ownerPrincipalId = `${suitePrefix}-owner`;
      tenantAdminPrincipalId = `${suitePrefix}-tenant-admin`;
      authorPrincipalId = `${suitePrefix}-author`;
      editorPrincipalId = `${suitePrefix}-editor`;
      ordinaryTeacherPrincipalId = `${suitePrefix}-ordinary-teacher`;
      crossTenantPrincipalId = `${suitePrefix}-cross-tenant`;
      suspendedPrincipalId = `${suitePrefix}-suspended`;

      await requirePrisma().tenant.createMany({
        data: [
          {
            id: tenantId,
            slug: `${suitePrefix}-tenant`,
            name: 'Question assignment integration tenant',
            auth0OrganizationId: `${suitePrefix}-auth0-org`,
          },
          {
            id: otherTenantId,
            slug: `${suitePrefix}-other-tenant`,
            name: 'Question assignment other tenant',
            auth0OrganizationId: `${suitePrefix}-other-auth0-org`,
          },
        ],
      });

      await requirePrisma().authPrincipal.createMany({
        data: [
          { id: ownerPrincipalId },
          { id: tenantAdminPrincipalId },
          { id: authorPrincipalId },
          { id: editorPrincipalId },
          { id: ordinaryTeacherPrincipalId },
          { id: crossTenantPrincipalId },
          { id: suspendedPrincipalId },
        ],
      });

      await requirePrisma().principalTenantMembership.createMany({
        data: [
          {
            principalId: ownerPrincipalId,
            tenantId,
            roles: ['teacher'],
          },
          {
            principalId: tenantAdminPrincipalId,
            tenantId,
            roles: ['tenant_admin'],
          },
          {
            principalId: authorPrincipalId,
            tenantId,
            roles: ['teacher'],
          },
          {
            principalId: editorPrincipalId,
            tenantId,
            roles: ['teacher'],
          },
          {
            principalId: ordinaryTeacherPrincipalId,
            tenantId,
            roles: ['teacher'],
          },
          {
            principalId: crossTenantPrincipalId,
            tenantId: otherTenantId,
            roles: ['teacher'],
          },
          {
            principalId: suspendedPrincipalId,
            tenantId,
            roles: ['teacher'],
            status: 'SUSPENDED',
          },
        ],
      });

      repository = new PrismaQuestionAssignmentRepository(database);
    });

    afterAll(async () => {
      if (prisma !== undefined) {
        await prisma.$disconnect();
        prisma = undefined;
      }
    });

    it('grants an AUTHOR assignment to an active tenant member', async () => {
      const fixture = await createQuestionFixture('grant-author');

      await repository.grant({
        actor: fixture.actor,
        questionId: fixture.questionId,
        principalId: authorPrincipalId,
        role: 'AUTHOR',
      });

      const assignment = await findAssignment(
        fixture.questionId,
        authorPrincipalId,
      );

      expect(assignment).toMatchObject({
        questionId: fixture.questionId,
        tenantId,
        principalId: authorPrincipalId,
        role: 'AUTHOR',
        assignedByPrincipalId: ownerPrincipalId,
      });
    });

    it('grants an EDITOR assignment and persists the assigning principal', async () => {
      const fixture = await createQuestionFixture('grant-editor');

      await repository.grant({
        actor: fixture.actor,
        questionId: fixture.questionId,
        principalId: editorPrincipalId,
        role: 'EDITOR',
      });

      const assignment = await findAssignment(
        fixture.questionId,
        editorPrincipalId,
      );

      expect(assignment).toMatchObject({
        questionId: fixture.questionId,
        tenantId,
        principalId: editorPrincipalId,
        role: 'EDITOR',
        assignedByPrincipalId: ownerPrincipalId,
      });

      expect(assignment?.createdAt).toBeInstanceOf(Date);
      expect(assignment?.updatedAt).toBeInstanceOf(Date);
    });

    it('changes an existing assignment role without changing its principal or assigner', async () => {
      const fixture = await createQuestionFixture('change-role');

      await repository.grant({
        actor: fixture.actor,
        questionId: fixture.questionId,
        principalId: authorPrincipalId,
        role: 'AUTHOR',
      });

      await repository.changeRole({
        actor: fixture.actor,
        questionId: fixture.questionId,
        principalId: authorPrincipalId,
        role: 'CO_AUTHOR',
      });

      const assignment = await findAssignment(
        fixture.questionId,
        authorPrincipalId,
      );

      expect(assignment).toMatchObject({
        questionId: fixture.questionId,
        tenantId,
        principalId: authorPrincipalId,
        role: 'CO_AUTHOR',
        assignedByPrincipalId: ownerPrincipalId,
      });
    });

    it('revokes an existing non-owner assignment', async () => {
      const fixture = await createQuestionFixture('revoke-editor');

      await repository.grant({
        actor: fixture.actor,
        questionId: fixture.questionId,
        principalId: editorPrincipalId,
        role: 'EDITOR',
      });

      await repository.revoke({
        actor: fixture.actor,
        questionId: fixture.questionId,
        principalId: editorPrincipalId,
      });

      await expect(
        findAssignment(fixture.questionId, editorPrincipalId),
      ).resolves.toBeNull();

      await expect(
        findAssignment(fixture.questionId, ownerPrincipalId),
      ).resolves.toMatchObject({
        role: 'OWNER',
      });
    });

    it('lists all assignments for a Question within the authorized tenant', async () => {
      const fixture = await createQuestionFixture('list-assignments');

      await repository.grant({
        actor: fixture.actor,
        questionId: fixture.questionId,
        principalId: authorPrincipalId,
        role: 'AUTHOR',
      });

      await repository.grant({
        actor: fixture.actor,
        questionId: fixture.questionId,
        principalId: editorPrincipalId,
        role: 'EDITOR',
      });

      const assignments = await repository.list({
        actor: fixture.actor,
        questionId: fixture.questionId,
      });

      expect(assignments).toHaveLength(3);

      const storedAssignments = await findAssignments(fixture.questionId);

      expect(
        storedAssignments.map((assignment) => ({
          principalId: assignment.principalId,
          role: assignment.role,
        })),
      ).toEqual(
        expect.arrayContaining([
          {
            principalId: ownerPrincipalId,
            role: 'OWNER',
          },
          {
            principalId: authorPrincipalId,
            role: 'AUTHOR',
          },
          {
            principalId: editorPrincipalId,
            role: 'EDITOR',
          },
        ]),
      );
    });

    it('allows a tenant administrator to manage assignments', async () => {
      const fixture = await createQuestionFixture('tenant-admin');

      await repository.grant({
        actor: actor(tenantAdminPrincipalId),
        questionId: fixture.questionId,
        principalId: authorPrincipalId,
        role: 'AUTHOR',
      });

      await expect(
        findAssignment(fixture.questionId, authorPrincipalId),
      ).resolves.toMatchObject({
        role: 'AUTHOR',
        assignedByPrincipalId: tenantAdminPrincipalId,
      });
    });

    it('does not allow an ordinary teacher without OWNER or administrator authority to manage assignments', async () => {
      const fixture = await createQuestionFixture('unauthorized-manager');

      await expect(
        repository.grant({
          actor: actor(ordinaryTeacherPrincipalId),
          questionId: fixture.questionId,
          principalId: authorPrincipalId,
          role: 'AUTHOR',
        }),
      ).rejects.toThrow();

      await expect(
        findAssignment(fixture.questionId, authorPrincipalId),
      ).resolves.toBeNull();
    });

    it('rejects a target principal who is not a member of the Question tenant', async () => {
      const fixture = await createQuestionFixture('cross-tenant-target');

      await expect(
        repository.grant({
          actor: fixture.actor,
          questionId: fixture.questionId,
          principalId: crossTenantPrincipalId,
          role: 'EDITOR',
        }),
      ).rejects.toThrow();

      await expect(
        findAssignment(fixture.questionId, crossTenantPrincipalId),
      ).resolves.toBeNull();
    });

    it('rejects a target principal with a suspended tenant membership', async () => {
      const fixture = await createQuestionFixture('suspended-target');

      await expect(
        repository.grant({
          actor: fixture.actor,
          questionId: fixture.questionId,
          principalId: suspendedPrincipalId,
          role: 'EDITOR',
        }),
      ).rejects.toThrow();

      await expect(
        findAssignment(fixture.questionId, suspendedPrincipalId),
      ).resolves.toBeNull();
    });

    it('rejects granting OWNER through the ordinary grant operation', async () => {
      const fixture = await createQuestionFixture('grant-owner-rejected');

      await expect(
        repository.grant({
          actor: fixture.actor,
          questionId: fixture.questionId,
          principalId: authorPrincipalId,
          // Deliberately bypass the compile-time contract to verify
          // that the persistence layer also rejects OWNER at runtime.
          role: 'OWNER' as never,
        }),
      ).rejects.toThrow();

      await expect(
        findAssignment(fixture.questionId, authorPrincipalId),
      ).resolves.toBeNull();

      await expect(
        findAssignment(fixture.questionId, ownerPrincipalId),
      ).resolves.toMatchObject({
        role: 'OWNER',
      });
    });

    it('rejects changing the OWNER role through the ordinary role-change operation', async () => {
      const fixture = await createQuestionFixture('change-owner-rejected');

      await expect(
        repository.changeRole({
          actor: fixture.actor,
          questionId: fixture.questionId,
          principalId: ownerPrincipalId,
          role: 'EDITOR',
        }),
      ).rejects.toThrow();

      await expect(
        findAssignment(fixture.questionId, ownerPrincipalId),
      ).resolves.toMatchObject({
        role: 'OWNER',
      });
    });

    it('rejects revoking the current OWNER through the ordinary revoke operation', async () => {
      const fixture = await createQuestionFixture('revoke-owner-rejected');

      await expect(
        repository.revoke({
          actor: fixture.actor,
          questionId: fixture.questionId,
          principalId: ownerPrincipalId,
        }),
      ).rejects.toThrow();

      await expect(
        findAssignment(fixture.questionId, ownerPrincipalId),
      ).resolves.toMatchObject({
        role: 'OWNER',
      });
    });

    it('transfers ownership atomically and preserves the immutable Question creator', async () => {
      const fixture = await createQuestionFixture('ownership-transfer');

      await repository.transferOwnership({
        actor: fixture.actor,
        questionId: fixture.questionId,
        newOwnerPrincipalId: authorPrincipalId,
      });

      const [question, previousOwner, newOwner, assignments] =
        await Promise.all([
          requirePrisma().question.findUnique({
            where: { id: fixture.questionId },
          }),
          findAssignment(fixture.questionId, ownerPrincipalId),
          findAssignment(fixture.questionId, authorPrincipalId),
          findAssignments(fixture.questionId),
        ]);

      expect(question).toMatchObject({
        id: fixture.questionId,
        tenantId,
        createdByPrincipalId: ownerPrincipalId,
      });

      expect(previousOwner).toMatchObject({
        role: 'EDITOR',
        assignedByPrincipalId: ownerPrincipalId,
      });

      expect(newOwner).toMatchObject({
        role: 'OWNER',
        assignedByPrincipalId: ownerPrincipalId,
      });

      expect(
        assignments.filter((assignment) => assignment.role === 'OWNER'),
      ).toHaveLength(1);
    });

    it('does not modify ownership when the proposed new owner is not an active tenant member', async () => {
      const fixture = await createQuestionFixture(
        'ownership-transfer-invalid-target',
      );

      await expect(
        repository.transferOwnership({
          actor: fixture.actor,
          questionId: fixture.questionId,
          newOwnerPrincipalId: crossTenantPrincipalId,
        }),
      ).rejects.toThrow();

      const [question, currentOwner, otherOwner] = await Promise.all([
        requirePrisma().question.findUnique({
          where: { id: fixture.questionId },
        }),
        findAssignment(fixture.questionId, ownerPrincipalId),
        findAssignment(fixture.questionId, crossTenantPrincipalId),
      ]);

      expect(question?.createdByPrincipalId).toBe(ownerPrincipalId);
      expect(currentOwner?.role).toBe('OWNER');
      expect(otherOwner).toBeNull();
    });

    it('rejects assignment management for a Question belonging to another tenant', async () => {
      const fixture = await createQuestionFixture('question-tenant-boundary');

      await expect(
        repository.grant({
          actor: {
            principalId: ownerPrincipalId,
            tenantId: otherTenantId,
          },
          questionId: fixture.questionId,
          principalId: authorPrincipalId,
          role: 'EDITOR',
        }),
      ).rejects.toThrow();

      await expect(
        findAssignment(fixture.questionId, authorPrincipalId),
      ).resolves.toBeNull();
    });

    it('rejects duplicate assignment grants without changing the existing assignment', async () => {
      const fixture = await createQuestionFixture('duplicate-grant');

      await repository.grant({
        actor: fixture.actor,
        questionId: fixture.questionId,
        principalId: authorPrincipalId,
        role: 'AUTHOR',
      });

      await expect(
        repository.grant({
          actor: fixture.actor,
          questionId: fixture.questionId,
          principalId: authorPrincipalId,
          role: 'EDITOR',
        }),
      ).rejects.toThrow();

      await expect(
        findAssignment(fixture.questionId, authorPrincipalId),
      ).resolves.toMatchObject({
        role: 'AUTHOR',
        assignedByPrincipalId: ownerPrincipalId,
      });
    });

    it('rejects changing the role of an assignment that does not exist', async () => {
      const fixture = await createQuestionFixture('change-missing');

      await expect(
        repository.changeRole({
          actor: fixture.actor,
          questionId: fixture.questionId,
          principalId: authorPrincipalId,
          role: 'EDITOR',
        }),
      ).rejects.toThrow();

      await expect(
        findAssignment(fixture.questionId, authorPrincipalId),
      ).resolves.toBeNull();
    });

    it('rejects listing assignments when the actor is not authorized to manage them', async () => {
      const fixture = await createQuestionFixture('unauthorized-list');

      await expect(
        repository.list({
          actor: actor(ordinaryTeacherPrincipalId),
          questionId: fixture.questionId,
        }),
      ).rejects.toThrow();
    });
  },
);
