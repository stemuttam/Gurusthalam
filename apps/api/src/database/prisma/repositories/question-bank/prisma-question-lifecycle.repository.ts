import {
  type QuestionId,
  QuestionOwnership,
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
import {
  PrismaRepositoryError,
  PrismaRepositoryErrorCode,
} from '../prisma-repository.error.js';

const CREATE_TENANT_ROLES = ['teacher', 'question_bank_admin', 'tenant_admin'] as const;
const APPEND_ASSIGNMENT_ROLES = ['OWNER', 'AUTHOR', 'CO_AUTHOR', 'EDITOR'] as const;

/**
 * Tenant-scoped Question lifecycle persistence.
 *
 * All write authorization is repeated inside the same PostgreSQL transaction
 * as the Question/version/outbox write. The immutable creator identity is
 * persisted on Question; the current actor is independently authorized for
 * each operation.
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
        options: { orderBy: { position: 'asc' as const } },
        matchingLeftItems: { orderBy: { position: 'asc' as const } },
        matchingRightItems: { orderBy: { position: 'asc' as const } },
        orderingItems: { orderBy: { position: 'asc' as const } },
        fillBlankSegments: { orderBy: { position: 'asc' as const } },
      },
    },
    answerKey: {
      include: {
        optionAnswers: { orderBy: { position: 'asc' as const } },
        acceptedAnswers: { orderBy: { position: 'asc' as const } },
        matchingPairs: { orderBy: { position: 'asc' as const } },
        orderingAnswers: { orderBy: { position: 'asc' as const } },
        blankAnswers: {
          orderBy: { position: 'asc' as const },
          include: {
            blankSegment: { select: { blankId: true } },
            acceptedAnswers: { orderBy: { position: 'asc' as const } },
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
            question: { is: { tenantId, createdByPrincipalId: { not: null } } },
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
            question: { is: { tenantId, createdByPrincipalId: { not: null } } },
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

  async findOwnership(
    tenantId: string,
    questionId: QuestionId,
  ): Promise<QuestionOwnership | null> {
    return withPrismaRepositoryErrorBoundary(
      'QuestionLifecycleRepository.findOwnership',
      async () => {
        const question = await this.prisma.question.findFirst({
          where: {
            id: questionId.value,
            tenantId,
            createdByPrincipalId: { not: null },
          },
          select: {
            tenantId: true,
            createdByPrincipalId: true,
          },
        });

        if (
          question === null ||
          question.tenantId === null ||
          question.createdByPrincipalId === null
        ) {
          return null;
        }

        return QuestionOwnership.create(
          question.tenantId,
          question.createdByPrincipalId,
        );
      },
    );
  }

  async persist(command: QuestionLifecycleWrite): Promise<void> {
    await withPrismaRepositoryErrorBoundary(
      'QuestionLifecycleRepository.persist',
      async () => {
        const { snapshot, ownership, event, actorPrincipalId } = command;
        const persistence = QuestionVersionPrismaMapper.toPersistence(snapshot);
        const { version } = persistence;
        const questionId = snapshot.questionId.value;
        const previousVersionId = snapshot.lineage.previousVersion?.id.value ?? null;
        const restoredFromVersionId = snapshot.lineage.restoredFromVersion?.id.value ?? null;

        this.assertCommandIntegrity(command, {
          questionId,
          version,
          previousVersionId,
          restoredFromVersionId,
        });

        await this.prisma.$transaction(
          async (transaction) => {
            // Resolve the current actor, not the immutable Question creator.
            const actorMembership = await transaction.principalTenantMembership.findFirst({
              where: {
                principalId: actorPrincipalId,
                tenantId: ownership.tenantId,
                status: 'ACTIVE',
                principal: { is: { status: 'ACTIVE' } },
                tenant: { is: { status: 'ACTIVE' } },
              },
              select: {
                principalId: true,
                roles: true,
              },
            });

            if (actorMembership === null) {
              throw new PrismaRepositoryError(
                'The authenticated principal is not an active member of this tenant.',
                PrismaRepositoryErrorCode.AUTHORIZATION_DENIED,
              );
            }

            if (command.operation === 'CREATE') {
              if (actorPrincipalId !== ownership.createdByPrincipalId) {
                throw new PrismaRepositoryError(
                  'The Question creator must be the authenticated principal.',
                  PrismaRepositoryErrorCode.AUTHORIZATION_DENIED,
                );
              }

              if (
                !actorMembership.roles.some((role) =>
                  (CREATE_TENANT_ROLES as readonly string[]).includes(role),
                )
              ) {
                throw new PrismaRepositoryError(
                  'The authenticated tenant membership cannot create Questions.',
                  PrismaRepositoryErrorCode.AUTHORIZATION_DENIED,
                );
              }

              // Explicit insert: never adopt or overwrite a legacy Question.
              await transaction.question.create({
                data: {
                  id: questionId,
                  tenantId: ownership.tenantId,
                  createdByPrincipalId: ownership.createdByPrincipalId,
                },
              });

              // Creator ownership and the initial version are one atomic unit.
              await transaction.questionAssignment.create({
                data: {
                  questionId,
                  tenantId: ownership.tenantId,
                  principalId: ownership.createdByPrincipalId,
                  role: 'OWNER',
                  assignedByPrincipalId: actorPrincipalId,
                },
              });
            } else {
              // All append and future assignment-mutation paths must acquire
              // this aggregate lock before reading/changing assignments.
              const locked = await transaction.$queryRaw<
                Array<{
                  id: string;
                  tenantId: string | null;
                  createdByPrincipalId: string | null;
                }>
              >`
                SELECT "id", "tenantId", "createdByPrincipalId"
                FROM "Question"
                WHERE "id" = ${questionId}
                  AND "tenantId" = ${ownership.tenantId}
                FOR UPDATE
              `;

              const question = locked[0];

              if (
                question === undefined ||
                question.tenantId !== ownership.tenantId ||
                question.createdByPrincipalId === null ||
                question.createdByPrincipalId !== ownership.createdByPrincipalId
              ) {
                throw new PrismaRepositoryError(
                  'The Question was not found in the authenticated tenant.',
                  PrismaRepositoryErrorCode.RECORD_NOT_FOUND,
                );
              }

              const assignment = await transaction.questionAssignment.findFirst({
                where: {
                  questionId,
                  tenantId: ownership.tenantId,
                  principalId: actorPrincipalId,
                  role: { in: [...APPEND_ASSIGNMENT_ROLES] },
                },
                select: { role: true },
              });

              if (assignment === null) {
                throw new PrismaRepositoryError(
                  'An active Question assignment is required for this operation.',
                  PrismaRepositoryErrorCode.AUTHORIZATION_DENIED,
                );
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
                throw new PrismaRepositoryError(
                  'The Question has changed since the requested version was read.',
                  PrismaRepositoryErrorCode.CONCURRENT_MODIFICATION,
                );
              }
            }

            await PrismaQuestionLifecycleRepository.insertSnapshot(
              transaction,
              persistence,
            );

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
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      },
    );
  }

  private assertCommandIntegrity(
    command: QuestionLifecycleWrite,
    context: {
      readonly questionId: string;
      readonly version: ReturnType<typeof QuestionVersionPrismaMapper.toPersistence>['version'];
      readonly previousVersionId: string | null;
      readonly restoredFromVersionId: string | null;
    },
  ): void {
    const { questionId, version, previousVersionId, restoredFromVersionId } = context;
    const { ownership, actorPrincipalId, event, snapshot } = command;

    if (
      event.eventVersion !== 1 ||
      event.aggregateType !== 'Question' ||
      event.aggregateId !== questionId ||
      event.payload.questionId !== questionId ||
      event.payload.questionVersionId !== version.id ||
      event.payload.versionNumber !== Number(version.versionNumber) ||
      event.payload.tenantId !== ownership.tenantId ||
      event.occurredAt.getTime() !== version.createdAt.getTime() ||
      snapshot.questionId.value !== questionId
    ) {
      throw new TypeError('Question lifecycle event does not match its snapshot or ownership.');
    }

    if (command.operation === 'CREATE') {
      if (
        event.eventName !== 'QuestionCreated' ||
        event.payload.createdByPrincipalId !== ownership.createdByPrincipalId ||
        actorPrincipalId !== ownership.createdByPrincipalId ||
        previousVersionId !== null ||
        restoredFromVersionId !== null ||
        version.previousVersionId !== null ||
        version.restoredFromVersionId !== null ||
        version.versionNumber !== 1n
      ) {
        throw new TypeError('CREATE requires the creator, initial version and QuestionCreated event.');
      }
      return;
    }

    if (
      event.eventName === 'QuestionCreated' ||
      event.payload.actorPrincipalId !== actorPrincipalId ||
      previousVersionId !== command.expectedPreviousVersionId.value ||
      version.previousVersionId !== previousVersionId
    ) {
      throw new TypeError('APPEND event actor or predecessor does not match the lifecycle command.');
    }

    if (
      event.eventName === 'QuestionRevised' &&
      (restoredFromVersionId !== null ||
        event.payload.previousVersionId !== previousVersionId ||
        version.restoredFromVersionId !== null)
    ) {
      throw new TypeError('QuestionRevised event does not match the version lineage.');
    }

    if (
      event.eventName === 'QuestionRestored' &&
      (restoredFromVersionId === null ||
        event.payload.previousVersionId !== previousVersionId ||
        event.payload.restoredFromVersionId !== restoredFromVersionId ||
        version.restoredFromVersionId !== restoredFromVersionId)
    ) {
      throw new TypeError('QuestionRestored event does not match the version lineage.');
    }
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
