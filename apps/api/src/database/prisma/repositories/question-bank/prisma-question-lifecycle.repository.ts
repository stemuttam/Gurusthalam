import {
  type QuestionId,
  type QuestionVersionId,
  type QuestionVersionSnapshot,
  type QuestionLifecycleRepository,
  type QuestionLifecycleWrite,
} from '@gurusthalam/question-bank';

import { Prisma, type PrismaClient } from '@gurusthalam/database';

import {
  QuestionVersionPrismaMapper,
  type PrismaQuestionVersionRecord,
} from '../../mappers/question-bank/index.js';

import { withPrismaRepositoryErrorBoundary } from '../prisma-repository-error.mapper.js';

/**
 * Tenant-scoped lifecycle persistence.
 *
 * The legacy QuestionVersionRepository remains available for its existing
 * read/test contracts. New lifecycle writes must use this adapter; it never
 * upserts Question and never accepts ownership from the draft.
 */
export class PrismaQuestionLifecycleRepository implements QuestionLifecycleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private static readonly relationGraph = {
    previousVersion: {
      select: {
        id: true,
        questionId: true,
        versionNumber: true,
      },
    },
    restoredFrom: {
      select: {
        id: true,
        questionId: true,
        versionNumber: true,
      },
    },
    content: {
      include: {
        options: {
          orderBy: { position: 'asc' as const },
        },
        matchingLeftItems: {
          orderBy: { position: 'asc' as const },
        },
        matchingRightItems: {
          orderBy: { position: 'asc' as const },
        },
        orderingItems: {
          orderBy: { position: 'asc' as const },
        },
        fillBlankSegments: {
          orderBy: { position: 'asc' as const },
        },
      },
    },
    answerKey: {
      include: {
        optionAnswers: {
          orderBy: { position: 'asc' as const },
        },
        acceptedAnswers: {
          orderBy: { position: 'asc' as const },
        },
        matchingPairs: {
          orderBy: { position: 'asc' as const },
        },
        orderingAnswers: {
          orderBy: { position: 'asc' as const },
        },
        blankAnswers: {
          orderBy: { position: 'asc' as const },
          include: {
            blankSegment: {
              select: {
                blankId: true,
              },
            },
            acceptedAnswers: {
              orderBy: { position: 'asc' as const },
            },
          },
        },
      },
    },
  };

  async findLatest(
    tenantId: string,
    questionId: QuestionId,
  ): Promise<QuestionVersionSnapshot | null> {
    return withPrismaRepositoryErrorBoundary(
      'QuestionLifecycleRepository.findLatest',
      async () => {
        const record = await this.prisma.questionVersion.findFirst({
          where: {
            questionId: questionId.value,
            completedAt: { not: null },
            question: { is: { tenantId } },
          },
          orderBy: { versionNumber: 'desc' },
          include: PrismaQuestionLifecycleRepository.relationGraph,
        });
        return record === null
          ? null
          : QuestionVersionPrismaMapper.toDomain(
              record as unknown as PrismaQuestionVersionRecord,
            );
      },
    );
  }

  async findVersion(
    tenantId: string,
    questionId: QuestionId,
    versionId: QuestionVersionId,
  ): Promise<QuestionVersionSnapshot | null> {
    return withPrismaRepositoryErrorBoundary(
      'QuestionLifecycleRepository.findVersion',
      async () => {
        const record = await this.prisma.questionVersion.findFirst({
          where: {
            id: versionId.value,
            questionId: questionId.value,
            completedAt: { not: null },
            question: { is: { tenantId } },
          },
          include: PrismaQuestionLifecycleRepository.relationGraph,
        });
        return record === null
          ? null
          : QuestionVersionPrismaMapper.toDomain(
              record as unknown as PrismaQuestionVersionRecord,
            );
      },
    );
  }

  async persist(command: QuestionLifecycleWrite): Promise<void> {
    await withPrismaRepositoryErrorBoundary(
      'QuestionLifecycleRepository.persist',
      async () => {
        const { snapshot, ownership, event } = command;
        const persistence = QuestionVersionPrismaMapper.toPersistence(snapshot);
        const { version } = persistence;
        const questionId = snapshot.questionId.value;

        const lineage = snapshot.lineage;
        const previousVersionId = lineage.previousVersion?.id.value ?? null;
        const restoredFromVersionId = lineage.restoredFromVersion?.id.value ?? null;

        if (
          event.eventVersion !== 1 ||
          event.aggregateType !== 'Question' ||
          event.aggregateId !== questionId ||
          event.payload.questionId !== questionId ||
          event.payload.questionVersionId !== version.id ||
          event.payload.versionNumber !== Number(version.versionNumber) ||
          event.payload.tenantId !== ownership.tenantId ||
          event.occurredAt.getTime() !== version.createdAt.getTime() ||
          (event.eventName === 'QuestionCreated' &&
            (event.payload.createdByPrincipalId !== ownership.createdByPrincipalId ||
              previousVersionId !== null ||
              restoredFromVersionId !== null ||
              version.previousVersionId !== null ||
              version.restoredFromVersionId !== null ||
              version.versionNumber !== 1n)) ||
          (event.eventName === 'QuestionRevised' &&
            (event.payload.actorPrincipalId !== ownership.createdByPrincipalId ||
              event.payload.previousVersionId !== previousVersionId ||
              restoredFromVersionId !== null ||
              version.previousVersionId !== previousVersionId ||
              version.restoredFromVersionId !== null)) ||
          (event.eventName === 'QuestionRestored' &&
            (event.payload.actorPrincipalId !== ownership.createdByPrincipalId ||
              event.payload.previousVersionId !== previousVersionId ||
              event.payload.restoredFromVersionId !== restoredFromVersionId ||
              version.previousVersionId !== previousVersionId ||
              version.restoredFromVersionId !== restoredFromVersionId ||
              restoredFromVersionId === null))
        ) {
          throw new TypeError(
            'Question lifecycle event does not match its snapshot, lineage, aggregate or ownership.',
          );
        }

        await this.prisma.$transaction(async (transaction) => {
          // Membership, principal and tenant status are checked at write time.
          const membership = await transaction.principalTenantMembership.findFirst({
            where: {
              principalId: ownership.createdByPrincipalId,
              tenantId: ownership.tenantId,
              status: 'ACTIVE',
              principal: { is: { status: 'ACTIVE' } },
              tenant: { is: { status: 'ACTIVE' } },
            },
            select: { principalId: true, tenantId: true },
          });

          if (membership === null) {
            throw new Error('An active principal, tenant and membership are required.');
          }

          if (command.operation === 'CREATE') {
            if (
              version.versionNumber !== 1n ||
              version.previousVersionId !== null ||
              version.restoredFromVersionId !== null ||
              event.eventName !== 'QuestionCreated'
            ) {
              throw new TypeError('CREATE requires an initial version and QuestionCreated event.');
            }

            // Explicit create: never adopt an existing or unassigned legacy Question.
            await transaction.question.create({
              data: {
                id: questionId,
                tenantId: ownership.tenantId,
                createdByPrincipalId: ownership.createdByPrincipalId,
              },
            });
          } else {
            // Serialize appends for this Question and exclude unassigned legacy rows.
            const locked = await transaction.$queryRaw<Array<{ id: string }>>`
              SELECT "id"
              FROM "Question"
              WHERE "id" = ${questionId}
                AND "tenantId" = ${ownership.tenantId}
                AND "createdByPrincipalId" IS NOT NULL
              FOR UPDATE
            `;

            if (locked.length !== 1) {
              throw new Error('Question was not found in the authenticated tenant.');
            }

            const latest = await transaction.questionVersion.findFirst({
              where: {
                questionId,
                completedAt: { not: null },
              },
              orderBy: { versionNumber: 'desc' },
              select: { id: true, versionNumber: true },
            });

            if (
              latest === null ||
              latest.id !== command.expectedPreviousVersionId.value ||
              version.versionNumber !== latest.versionNumber + 1n ||
              version.previousVersionId !== latest.id
            ) {
              throw new Error('Question version conflict: the expected predecessor is no longer current.');
            }

            if (
              event.eventName !== 'QuestionRevised' &&
              event.eventName !== 'QuestionRestored'
            ) {
              throw new TypeError('APPEND requires a QuestionRevised or QuestionRestored event.');
            }
          }

          // Insert the complete normalized snapshot. No Question upsert occurs here.
          await PrismaQuestionLifecycleRepository.insertSnapshot(
            transaction,
            persistence,
          );

          // The full immutable event envelope is committed with the snapshot.
          await transaction.outboxEvent.create({
            data: {
              eventType: event.eventName,
              aggregateType: 'Question',
              aggregateId: questionId,
              dedupeKey: `question-domain-event:${event.eventId}`,
              payload: JSON.parse(JSON.stringify(event)) as Prisma.InputJsonValue,
              status: 'PENDING',
              attempts: 0,
              availableAt: event.occurredAt,
            },
          });
        });
      },
    );
  }

  private static async insertSnapshot(
    transaction: Prisma.TransactionClient,
    persistence: ReturnType<typeof QuestionVersionPrismaMapper.toPersistence>,
  ): Promise<void> {
    const { version } = persistence;
    // 2. Insert the version as incomplete. The database completion
        //    trigger is deferred until transaction commit.
        await transaction.questionVersion.create({
          data: {
            id: version.id,
            questionId: version.questionId,
            versionNumber: version.versionNumber,
            questionType: version.questionType,
            answerFormat: version.answerFormat,
            previousVersionId: version.previousVersionId,
            restoredFromVersionId: version.restoredFromVersionId,
            createdAt: version.createdAt,
            completedAt: null,
          },
        });

        // 3. Insert the normalized content parent.
        const content = version.content;

        await transaction.questionVersionContent.create({
          data: {
            id: content.id,
            questionVersionId: content.questionVersionId,
            questionType: content.questionType,
            promptText: content.promptText,
            numericUnit: content.numericUnit,
            matchingMode: content.matchingMode,
          },
        });

        // 4. Insert content child collections.
        if (content.options.length > 0) {
          await transaction.questionVersionOption.createMany({
            data: content.options.map((item) => ({
              id: item.id,
              contentId: content.id,
              questionVersionId: content.questionVersionId,
              text: item.text,
              position: item.position,
            })),
          });
        }

        if (content.matchingLeftItems.length > 0) {
          await transaction.questionVersionMatchingLeftItem.createMany({
            data: content.matchingLeftItems.map((item) => ({
              id: item.id,
              contentId: content.id,
              questionVersionId: content.questionVersionId,
              text: item.text,
              position: item.position,
            })),
          });
        }

        if (content.matchingRightItems.length > 0) {
          await transaction.questionVersionMatchingRightItem.createMany({
            data: content.matchingRightItems.map((item) => ({
              id: item.id,
              contentId: content.id,
              questionVersionId: content.questionVersionId,
              text: item.text,
              position: item.position,
            })),
          });
        }

        if (content.orderingItems.length > 0) {
          await transaction.questionVersionOrderingItem.createMany({
            data: content.orderingItems.map((item) => ({
              id: item.id,
              contentId: content.id,
              questionVersionId: content.questionVersionId,
              text: item.text,
              position: item.position,
            })),
          });
        }

        if (content.fillBlankSegments.length > 0) {
          await transaction.questionVersionFillBlankSegment.createMany({
            data: content.fillBlankSegments.map((segment) => ({
              id: segment.id,
              contentId: content.id,
              questionVersionId: content.questionVersionId,
              kind: segment.kind,
              text: segment.text,
              blankId: segment.blankId,
              position: segment.position,
            })),
          });
        }

        // 5. Insert the normalized answer-key parent.
        const answerKey = version.answerKey;

        await transaction.questionVersionAnswerKey.create({
          data: {
            id: answerKey.id,
            questionVersionId: answerKey.questionVersionId,
            questionType: answerKey.questionType,
            correctBoolean: answerKey.correctBoolean,
            expectedNumericValue: answerKey.expectedNumericValue,
            referenceAnswer: answerKey.referenceAnswer,
          },
        });

        // 6. Insert type-specific answer rows.
        if (answerKey.optionAnswers.length > 0) {
          await transaction.questionVersionOptionAnswer.createMany({
            data: answerKey.optionAnswers.map((answer) => ({
              answerKeyId: answerKey.id,
              questionVersionId: answerKey.questionVersionId,
              optionId: answer.optionId,
              position: answer.position,
            })),
          });
        }

        if (answerKey.acceptedAnswers.length > 0) {
          await transaction.questionVersionAcceptedAnswer.createMany({
            data: answerKey.acceptedAnswers.map((answer) => ({
              id: answer.id,
              answerKeyId: answerKey.id,
              questionVersionId: answerKey.questionVersionId,
              text: answer.text,
              position: answer.position,
            })),
          });
        }

        if (answerKey.matchingPairs.length > 0) {
          await transaction.questionVersionMatchingPair.createMany({
            data: answerKey.matchingPairs.map((pair) => ({
              answerKeyId: answerKey.id,
              questionVersionId: answerKey.questionVersionId,
              leftItemId: pair.leftItemId,
              rightItemId: pair.rightItemId,
              position: pair.position,
            })),
          });
        }

        if (answerKey.orderingAnswers.length > 0) {
          await transaction.questionVersionOrderingAnswer.createMany({
            data: answerKey.orderingAnswers.map((answer) => ({
              answerKeyId: answerKey.id,
              questionVersionId: answerKey.questionVersionId,
              itemId: answer.itemId,
              position: answer.position,
            })),
          });
        }

        // 7. Insert blank answer groups before their accepted answers.
        if (answerKey.blankAnswers.length > 0) {
          await transaction.questionVersionBlankAnswer.createMany({
            data: answerKey.blankAnswers.map((answer) => ({
              answerKeyId: answerKey.id,
              questionVersionId: answerKey.questionVersionId,
              blankSegmentId: answer.blankSegmentId,
              position: answer.position,
            })),
          });

          const blankAcceptedAnswers = answerKey.blankAnswers.flatMap(
            (blankAnswer) =>
              blankAnswer.acceptedAnswers.map((answer) => ({
                id: answer.id,
                answerKeyId: answerKey.id,
                blankSegmentId: blankAnswer.blankSegmentId,
                text: answer.text,
                position: answer.position,
              })),
          );

          if (blankAcceptedAnswers.length > 0) {
            await transaction.questionVersionBlankAcceptedAnswer.createMany({
              data: blankAcceptedAnswers,
            });
          }
        }

        // 8. Mark the snapshot complete only after every required row
        //    has been inserted successfully.
        await transaction.questionVersion.update({
          where: {
            id: version.id,
          },
          data: {
            completedAt: version.createdAt,
          },
        });
  }
}
