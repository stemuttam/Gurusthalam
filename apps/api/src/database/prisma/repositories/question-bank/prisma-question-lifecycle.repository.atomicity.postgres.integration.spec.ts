import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  AnswerFormat,
  QuestionId,
  QuestionOwnership,
  QuestionType,
  QuestionVersionId,
  QuestionVersionLineage,
  QuestionVersionNumber,
  QuestionVersionReference,
  createQuestionCreatedEvent,
  createQuestionVersionSnapshot,
  type AnyQuestionVersionSnapshotInput,
} from '@gurusthalam/question-bank';

import { PrismaService } from '../../prisma.service.js';
import { PrismaQuestionLifecycleRepository } from './prisma-question-lifecycle.repository.js';

const databaseAvailable = Boolean(process.env.DATABASE_URL);

const suitePrefix = `phase-5-14-f-atomicity-${randomUUID()}`;

describe.skipIf(!databaseAvailable)(
  'PrismaQuestionLifecycleRepository - PostgreSQL atomicity',
  () => {
    let prisma: PrismaService | undefined;

    const requirePrisma = (): PrismaService => {
      if (prisma === undefined) {
        throw new Error(
          'PostgreSQL integration database was not initialized.',
        );
      }

      return prisma;
    };

    let repository: PrismaQuestionLifecycleRepository;
    let ownership: QuestionOwnership;

    beforeAll(async () => {
      const database = new PrismaService();
      prisma = database;
      await database.$connect();

      const tenantId = `${suitePrefix}-tenant`;
      const principalId = `${suitePrefix}-principal`;

      await requirePrisma().tenant.create({
        data: {
          id: tenantId,
          slug: `${suitePrefix}-tenant`,
          name: 'Question lifecycle atomicity tenant',
          auth0OrganizationId: `${suitePrefix}-auth0-org`,
        },
      });

      await requirePrisma().authPrincipal.create({
        data: { id: principalId },
      });

      await requirePrisma().principalTenantMembership.create({
        data: {
          principalId,
          tenantId,
          roles: ['teacher'],
        },
      });

      ownership = QuestionOwnership.create(
        tenantId,
        principalId,
      );

      repository = new PrismaQuestionLifecycleRepository(database);
    });

    afterAll(async () => {
      if (prisma !== undefined) {
        await prisma.$disconnect();
        prisma = undefined;
      }
    });

    it(
      'rolls back the Question and every version row when outbox insertion fails',
      async () => {
        const questionIdValue = `${suitePrefix}-rollback-question`;
        const versionIdValue = `${suitePrefix}-rollback-version`;

        const questionId = QuestionId.from(questionIdValue);
        const versionId = QuestionVersionId.from(versionIdValue);
        const versionNumber = QuestionVersionNumber.initial();

        const current = QuestionVersionReference.create(
          versionId,
          questionId,
          versionNumber,
        );

        const createdAt = new Date('2026-02-02T00:00:00.000Z');

        const snapshot = createQuestionVersionSnapshot({
          id: versionId,
          questionId,
          versionNumber,
          questionType: QuestionType.SINGLE_CHOICE,
          answerFormat: AnswerFormat.SELECTED_OPTION,
          content: {
            questionType: 'SINGLE_CHOICE',
            prompt: { text: 'Which is a planet?' },
            options: [
              {
                id: `${versionIdValue}-earth`,
                text: 'Earth',
              },
              {
                id: `${versionIdValue}-moon`,
                text: 'Moon',
              },
            ],
          },
          answerKey: {
            questionType: 'SINGLE_CHOICE',
            correctOptionId: `${versionIdValue}-earth`,
          },
          lineage: QuestionVersionLineage.create(
            current,
            null,
            null,
          ),
          createdAt,
        } as AnyQuestionVersionSnapshotInput);

        const event = createQuestionCreatedEvent(
          questionId,
          versionId,
          versionNumber,
          ownership,
          createdAt,
        );

        const dedupeKey =
          `question-domain-event:${event.eventId}`;

        // Reserve the exact dedupe key so the repository's outbox
        // insertion fails with a unique-constraint violation.
        await requirePrisma().outboxEvent.create({
          data: {
            eventType: 'TestDedupeReservation',
            aggregateType: 'Question',
            aggregateId: questionIdValue,
            dedupeKey,
            payload: { reserved: true },
            status: 'PENDING',
            attempts: 0,
            availableAt: createdAt,
          },
        });

        await expect(
          repository.persist({
            operation: 'CREATE',
            snapshot,
            ownership,
            actorPrincipalId: ownership.createdByPrincipalId,
            event,
          }),
        ).rejects.toThrow();

        const [
          question,
          version,
          content,
          answerKey,
          ownerAssignment,
        ] = await Promise.all([
          requirePrisma().question.findUnique({
            where: { id: questionIdValue },
          }),
          requirePrisma().questionVersion.findUnique({
            where: { id: versionIdValue },
          }),
          requirePrisma().questionVersionContent.findUnique({
            where: { questionVersionId: versionIdValue },
          }),
          requirePrisma().questionVersionAnswerKey.findUnique({
            where: { questionVersionId: versionIdValue },
          }),
          requirePrisma().questionAssignment.findUnique({
            where: {
              questionId_principalId: {
                questionId: questionIdValue,
                principalId: ownership.createdByPrincipalId,
              },
            },
          }),
        ]);

        expect(question).toBeNull();
        expect(version).toBeNull();
        expect(content).toBeNull();
        expect(answerKey).toBeNull();
        expect(ownerAssignment).toBeNull();

        const reservedEvent =
          await requirePrisma().outboxEvent.findUnique({
            where: { dedupeKey },
          });

        expect(reservedEvent?.eventType).toBe(
          'TestDedupeReservation',
        );
      },
    );
  },
);