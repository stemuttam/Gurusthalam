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

import { PrismaQuestionVersionRepository } from './prisma-question-version.repository.js';

describe('PrismaQuestionVersionRepository - PostgreSQL transaction atomicity', () => {
  const suffix = `phase-5-14-e-f-d-${randomUUID()}`;
  const questionId = `${suffix}-question`;
  const versionId = `${suffix}-version`;

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

  function createInvalidMatchingSnapshot(): QuestionVersionSnapshot {
    const id = QuestionVersionId.from(versionId);
    const aggregateId = QuestionId.from(questionId);
    const versionNumber = QuestionVersionNumber.from(1);

    const currentReference = QuestionVersionReference.create(
      id,
      aggregateId,
      versionNumber,
    );

    const validInput = {
      id,
      questionId: aggregateId,
      versionNumber,
      questionType: QuestionType.MATCHING,
      answerFormat: AnswerFormat.MATCHING_PAIRS,
      content: {
        questionType: 'MATCHING',
        matchingMode: 'MANY_TO_ONE',
        prompt: {
          text: 'Match each item with its category.',
        },
        leftItems: [
          { id: `${suffix}-left-1`, text: 'Rose' },
          { id: `${suffix}-left-2`, text: 'Mango' },
        ],
        rightItems: [
          { id: `${suffix}-right-1`, text: 'Plant' },
          { id: `${suffix}-right-2`, text: 'Animal' },
        ],
      },
      answerKey: {
        questionType: 'MATCHING',
        correctPairs: [
          {
            leftItemId: `${suffix}-left-1`,
            rightItemId: `${suffix}-right-1`,
          },
          {
            leftItemId: `${suffix}-left-2`,
            rightItemId: `${suffix}-right-1`,
          },
        ],
      },
      lineage: QuestionVersionLineage.create(currentReference, null, null),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    } satisfies AnyQuestionVersionSnapshotInput;

    const validSnapshot = createQuestionVersionSnapshot(validInput);

    // Deliberately construct an invalid persistence-boundary snapshot.
    // The domain factory receives valid data; the cloned object simulates
    // malformed input reaching the repository boundary.
    return {
      ...validSnapshot,
      answerKey: {
        ...validSnapshot.answerKey,
        correctPairs: [],
      },
    } as QuestionVersionSnapshot;
  }

  it('rolls back every inserted row when PostgreSQL rejects an incomplete matching snapshot at commit', async () => {
    const invalidSnapshot = createInvalidMatchingSnapshot();

    await expect(repository.add(invalidSnapshot)).rejects.toThrow();

    // The Question identity upsert must also roll back.
    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });

    expect(question).toBeNull();

    const version = await prisma.questionVersion.findUnique({
      where: { id: versionId },
    });

    expect(version).toBeNull();

    const contentCount = await prisma.questionVersionContent.count({
      where: { questionVersionId: versionId },
    });

    expect(contentCount).toBe(0);

    const answerKeyCount = await prisma.questionVersionAnswerKey.count({
      where: { questionVersionId: versionId },
    });

    expect(answerKeyCount).toBe(0);

    const leftItemCount = await prisma.questionVersionMatchingLeftItem.count({
      where: { questionVersionId: versionId },
    });

    expect(leftItemCount).toBe(0);

    const rightItemCount = await prisma.questionVersionMatchingRightItem.count({
      where: { questionVersionId: versionId },
    });

    expect(rightItemCount).toBe(0);

    const matchingPairCount = await prisma.questionVersionMatchingPair.count({
      where: { questionVersionId: versionId },
    });

    expect(matchingPairCount).toBe(0);
  });
});
