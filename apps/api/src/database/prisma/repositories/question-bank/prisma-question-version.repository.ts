import {
  type QuestionId,
  type QuestionVersionId,
  type QuestionVersionNumber,
  type QuestionVersionRepository,
  type QuestionVersionSnapshot,
} from '@gurusthalam/question-bank';

import type { PrismaClient } from '@gurusthalam/database';

import {
  QuestionVersionPrismaMapper,
  type PrismaQuestionVersionRecord,
} from '../../mappers/question-bank/index.js';

import { withPrismaRepositoryErrorBoundary } from '../prisma-repository-error.mapper.js';

/**
 * Prisma-backed implementation of QuestionVersionRepository.
 *
 * Persistence characteristics:
 * - Immutable, insert-only QuestionVersion snapshots.
 * - Explicit relational persistence for all nine question types.
 * - One PostgreSQL transaction per snapshot.
 * - Completion is recorded only after all dependent rows are inserted.
 * - Relation-hydrated reads are passed through the domain mapper.
 *
 * The repository deliberately does not expose Prisma types through
 * the domain repository contract.
 */
export class PrismaQuestionVersionRepository implements QuestionVersionRepository {
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

  async findById(
    id: QuestionVersionId,
  ): Promise<QuestionVersionSnapshot | null> {
    return withPrismaRepositoryErrorBoundary(
      'QuestionVersionRepository.findById',
      async () => {
        const record = await this.prisma.questionVersion.findUnique({
          where: { id: id.value },
          include: PrismaQuestionVersionRepository.relationGraph,
        });

        if (record === null) {
          return null;
        }

        return QuestionVersionPrismaMapper.toDomain(
          record as unknown as PrismaQuestionVersionRecord,
        );
      },
    );
  }

  async findAllByQuestionId(
    questionId: QuestionId,
  ): Promise<readonly QuestionVersionSnapshot[]> {
    return withPrismaRepositoryErrorBoundary(
      'QuestionVersionRepository.findAllByQuestionId',
      async () => {
        const records = await this.prisma.questionVersion.findMany({
          where: {
            questionId: questionId.value,
            completedAt: { not: null },
          },
          orderBy: {
            versionNumber: 'asc',
          },
          include: PrismaQuestionVersionRepository.relationGraph,
        });

        return records.map((record) =>
          QuestionVersionPrismaMapper.toDomain(
            record as unknown as PrismaQuestionVersionRecord,
          ),
        );
      },
    );
  }

  async findLatestByQuestionId(
    questionId: QuestionId,
  ): Promise<QuestionVersionSnapshot | null> {
    return withPrismaRepositoryErrorBoundary(
      'QuestionVersionRepository.findLatestByQuestionId',
      async () => {
        const record = await this.prisma.questionVersion.findFirst({
          where: {
            questionId: questionId.value,
            completedAt: { not: null },
          },
          orderBy: {
            versionNumber: 'desc',
          },
          include: PrismaQuestionVersionRepository.relationGraph,
        });

        if (record === null) {
          return null;
        }

        return QuestionVersionPrismaMapper.toDomain(
          record as unknown as PrismaQuestionVersionRecord,
        );
      },
    );
  }

  async existsByQuestionIdAndVersion(
    questionId: QuestionId,
    versionNumber: QuestionVersionNumber,
  ): Promise<boolean> {
    return withPrismaRepositoryErrorBoundary(
      'QuestionVersionRepository.existsByQuestionIdAndVersion',
      async () => {
        const record = await this.prisma.questionVersion.findUnique({
          where: {
            questionId_versionNumber: {
              questionId: questionId.value,
              versionNumber: BigInt(versionNumber.value),
            },
          },
          select: {
            id: true,
          },
        });

        return record !== null;
      },
    );
  }

  /**
   * Inserts a complete immutable snapshot atomically.
   *
   * Question upsert is limited to the stable Question identity row.
   * QuestionVersion itself is always created using create(), never upsert.
   */
  async add(snapshot: QuestionVersionSnapshot): Promise<void> {
    await withPrismaRepositoryErrorBoundary(
      'QuestionVersionRepository.add',
      async () => {
        const persistence = QuestionVersionPrismaMapper.toPersistence(snapshot);

        const { version } = persistence;

        await this.prisma.$transaction(async (transaction) => {
          // 1. Ensure the stable Question identity exists.
          await transaction.question.upsert({
            where: {
              id: persistence.question.id,
            },
            create: {
              id: persistence.question.id,
            },
            update: {},
          });

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
        });
      },
    );
  }
}
