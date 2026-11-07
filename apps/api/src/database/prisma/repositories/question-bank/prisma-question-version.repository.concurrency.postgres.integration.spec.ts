
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  AnswerFormat,
  QuestionId,
  QuestionType,
  QuestionVersionId,
  QuestionVersionLineage,
  QuestionVersionNumber,
  QuestionVersionReference,
  createQuestionVersionSnapshot,
  type AnyQuestionVersionSnapshotInput,
  type QuestionVersionSnapshot,
} from '@gurusthalam/question-bank';

import { PrismaService } from '../../prisma.service.js';

import {
  PrismaRepositoryError,
} from '../prisma-repository.error.js';

import { PrismaQuestionVersionRepository } from './prisma-question-version.repository.js';

const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');

const suitePrefix = `phase-5-14-e-g-${randomUUID()}`;

function createTrueFalseSnapshot(
  id: string,
  questionId: string,
  versionNumber: number,
  prompt: string,
  previousVersion: QuestionVersionSnapshot | null = null,
): QuestionVersionSnapshot {
  const versionId = QuestionVersionId.from(id);
  const aggregateId = QuestionId.from(questionId);
  const number = QuestionVersionNumber.from(versionNumber);

  const currentReference = QuestionVersionReference.create(
    versionId,
    aggregateId,
    number,
  );

  const previousReference =
    previousVersion === null
      ? null
      : QuestionVersionReference.create(
          previousVersion.id,
          previousVersion.questionId,
          previousVersion.versionNumber,
        );

  const input = {
    id: versionId,
    questionId: aggregateId,
    versionNumber: number,
    questionType: QuestionType.TRUE_FALSE,
    answerFormat: AnswerFormat.BOOLEAN,
    content: {
      questionType: 'TRUE_FALSE',
      prompt: {
        text: prompt,
      },
    },
    answerKey: {
      questionType: 'TRUE_FALSE',
      correctValue: true,
    },
    lineage: QuestionVersionLineage.create(
      currentReference,
      previousReference,
      null,
    ),
    createdAt: new Date(CREATED_AT.getTime() + versionNumber),
  } satisfies AnyQuestionVersionSnapshotInput;

  return createQuestionVersionSnapshot(input);
}

describe(
  'PrismaQuestionVersionRepository - PostgreSQL concurrency regression',
  () => {
    let prisma: PrismaService;
    let repository: PrismaQuestionVersionRepository;

    beforeAll(async () => {
      prisma = new PrismaService();

      await prisma.$connect();

      repository = new PrismaQuestionVersionRepository(prisma);
    });

    afterAll(async () => {
      if (prisma !== undefined) {
        await prisma.$disconnect();
      }
    });

    function createQuestionIdentity(label: string) {
      const suffix = `${suitePrefix}-${label}`;

      return {
        questionId: `${suffix}-question`,
        versionPrefix: `${suffix}-version`,
      };
    }

    it(
      'allows exactly one competing writer to create the same next version and leaves no partial loser records',
      async () => {
        const identity = createQuestionIdentity('competing-writers');

        const first = createTrueFalseSnapshot(
          `${identity.versionPrefix}-1`,
          identity.questionId,
          1,
          'Initial question version.',
        );

        await repository.add(first);

        const candidateCount = 6;

        const candidates = Array.from(
          { length: candidateCount },
          (_, index) =>
            createTrueFalseSnapshot(
              `${identity.versionPrefix}-2-candidate-${index + 1}`,
              identity.questionId,
              2,
              `Concurrent candidate ${index + 1}.`,
              first,
            ),
        );

        // All candidates target the same logical next version.
        // The database lineage lock and unique version constraint
        // must prevent more than one candidate from committing.
        const results = await Promise.allSettled(
          candidates.map((candidate) => repository.add(candidate)),
        );

        const fulfilledIndexes = results.flatMap(
          (result, index) =>
            result.status === 'fulfilled' ? [index] : [],
        );

        const rejectedResults = results.filter(
          (result) => result.status === 'rejected',
        );

        expect(fulfilledIndexes).toHaveLength(1);
        expect(rejectedResults).toHaveLength(candidateCount - 1);

        for (const result of rejectedResults) {
          if (result.status !== 'rejected') {
            throw new Error('Expected a rejected concurrent writer.');
          }

          // The repository boundary must normalize database errors.
          // The exact PostgreSQL/Prisma code depends on which database
          // guard rejects the losing transaction.
          expect(result.reason).toBeInstanceOf(PrismaRepositoryError);
        }

        const winningIndex = fulfilledIndexes[0];

        if (winningIndex === undefined) {
          throw new Error('No concurrent QuestionVersion writer succeeded.');
        }

        const winningSnapshot = candidates[winningIndex];

        if (winningSnapshot === undefined) {
          throw new Error('The winning QuestionVersion candidate is missing.');
        }

        const losingIds = candidates
          .filter(
            (candidate) => candidate.id.value !== winningSnapshot.id.value,
          )
          .map((candidate) => candidate.id.value);

        const persistedVersions = await prisma.questionVersion.findMany({
          where: {
            questionId: identity.questionId,
          },
          orderBy: {
            versionNumber: 'asc',
          },
        });

        // Only the initial version and the single winning revision exist.
        expect(persistedVersions).toHaveLength(2);

        expect(
          persistedVersions.map((version) => ({
            id: version.id,
            versionNumber: version.versionNumber,
          })),
        ).toEqual([
          {
            id: first.id.value,
            versionNumber: 1n,
          },
          {
            id: winningSnapshot.id.value,
            versionNumber: 2n,
          },
        ]);

        expect(
          persistedVersions.every((version) => version.completedAt !== null),
        ).toBe(true);

        // Every losing transaction must leave no version, content,
        // or answer-key records behind.
        const losingVersionCount = await prisma.questionVersion.count({
          where: {
            id: {
              in: losingIds,
            },
          },
        });

        const losingContentCount =
          await prisma.questionVersionContent.count({
            where: {
              questionVersionId: {
                in: losingIds,
              },
            },
          });

        const losingAnswerKeyCount =
          await prisma.questionVersionAnswerKey.count({
            where: {
              questionVersionId: {
                in: losingIds,
              },
            },
          });

        expect(losingVersionCount).toBe(0);
        expect(losingContentCount).toBe(0);
        expect(losingAnswerKeyCount).toBe(0);

        // Verify the winning version can be hydrated and used as
        // the immediate predecessor of a subsequent valid revision.
        const hydratedWinner = await repository.findById(
          winningSnapshot.id,
        );

        expect(hydratedWinner).not.toBeNull();

        const third = createTrueFalseSnapshot(
          `${identity.versionPrefix}-3`,
          identity.questionId,
          3,
          'Valid revision after the concurrent conflict.',
          hydratedWinner,
        );

        await repository.add(third);

        const finalHistory = await repository.findAllByQuestionId(
          QuestionId.from(identity.questionId),
        );

        expect(
          finalHistory.map((version) => version.versionNumber.value),
        ).toEqual([1, 2, 3]);

        expect(finalHistory[2]?.lineage.previousVersion?.id.value).toBe(
          winningSnapshot.id.value,
        );
      },
    );

    it(
      'rejects a version-number gap and rolls back the attempted revision',
      async () => {
        const identity = createQuestionIdentity('version-gap');

        const first = createTrueFalseSnapshot(
          `${identity.versionPrefix}-1`,
          identity.questionId,
          1,
          'Initial question version.',
        );

        await repository.add(first);

        // Deliberately construct an invalid persistence-boundary snapshot.
        //
        // The domain factory correctly rejects a version gap, so this
        // regression must not use QuestionVersionLineage.create() to
        // construct the invalid candidate. Instead, retain the valid
        // snapshot's lineage (which has no predecessor) and alter only
        // its persistence version identity.
        //
        // The repository mapper reads versionNumber from the snapshot
        // and previousVersionId from lineage. PostgreSQL must reject
        // version 3 when version 1 is the latest persisted version.
        const invalidThird = Object.freeze({
          ...first,
          id: QuestionVersionId.from(`${identity.versionPrefix}-3`),
          versionNumber: QuestionVersionNumber.from(3),
          createdAt: new Date(CREATED_AT.getTime() + 3),
        }) as unknown as QuestionVersionSnapshot;

        await expect(repository.add(invalidThird)).rejects.toBeInstanceOf(
          PrismaRepositoryError,
        );

        const persistedVersions = await prisma.questionVersion.findMany({
          where: {
            questionId: identity.questionId,
          },
        });

        expect(persistedVersions).toHaveLength(1);
        expect(persistedVersions[0]?.id).toBe(first.id.value);
        expect(persistedVersions[0]?.versionNumber).toBe(1n);

        expect(
          await prisma.questionVersion.findUnique({
            where: {
              id: invalidThird.id.value,
            },
          }),
        ).toBeNull();

        expect(
          await prisma.questionVersionContent.count({
            where: {
              questionVersionId: invalidThird.id.value,
            },
          }),
        ).toBe(0);

        expect(
          await prisma.questionVersionAnswerKey.count({
            where: {
              questionVersionId: invalidThird.id.value,
            },
          }),
        ).toBe(0);
      },
    );

  },
);
