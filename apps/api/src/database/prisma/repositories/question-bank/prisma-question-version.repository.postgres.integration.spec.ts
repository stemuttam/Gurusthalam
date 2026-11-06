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

const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');

const suitePrefix = `phase-5-14-e-e-a-${randomUUID()}`;

function createSnapshot(
  questionType: QuestionType,
  answerFormat: AnswerFormat,
  content: AnyQuestionVersionSnapshotInput['content'],
  answerKey: AnyQuestionVersionSnapshotInput['answerKey'],
  id: string,
  questionId: string,
  versionNumber = 1,
  previousVersion?: QuestionVersionSnapshot,
  restoredFrom?: QuestionVersionSnapshot,
): QuestionVersionSnapshot {
  const versionId = QuestionVersionId.from(id);
  const aggregateId = QuestionId.from(questionId);
  const number = QuestionVersionNumber.from(versionNumber);

  const current = QuestionVersionReference.create(
    versionId,
    aggregateId,
    number,
  );

  const previousReference =
    previousVersion === undefined
      ? null
      : QuestionVersionReference.create(
          previousVersion.id,
          previousVersion.questionId,
          previousVersion.versionNumber,
        );

  const restoredReference =
    restoredFrom === undefined
      ? null
      : QuestionVersionReference.create(
          restoredFrom.id,
          restoredFrom.questionId,
          restoredFrom.versionNumber,
        );

  return createQuestionVersionSnapshot({
    id: versionId,
    questionId: aggregateId,
    versionNumber: number,
    questionType,
    answerFormat,
    content,
    answerKey,
    lineage: QuestionVersionLineage.create(
      current,
      previousReference,
      restoredReference,
    ),
    createdAt: new Date(CREATED_AT.getTime() + versionNumber),
  } as AnyQuestionVersionSnapshotInput);
}

function createFixtures() {
  return [
    {
      name: 'SINGLE_CHOICE',
      create: (id: string, questionId: string) =>
        createSnapshot(
          QuestionType.SINGLE_CHOICE,
          AnswerFormat.SELECTED_OPTION,
          {
            questionType: 'SINGLE_CHOICE',
            prompt: { text: 'Which planet is known as the Red Planet?' },
            options: [
              { id: `${id}-mars`, text: 'Mars' },
              { id: `${id}-venus`, text: 'Venus' },
              { id: `${id}-jupiter`, text: 'Jupiter' },
            ],
          },
          {
            questionType: 'SINGLE_CHOICE',
            correctOptionId: `${id}-mars`,
          },
          id,
          questionId,
        ),
    },
    {
      name: 'MULTIPLE_CHOICE',
      create: (id: string, questionId: string) =>
        createSnapshot(
          QuestionType.MULTIPLE_CHOICE,
          AnswerFormat.SELECTED_OPTIONS,
          {
            questionType: 'MULTIPLE_CHOICE',
            prompt: { text: 'Select the prime numbers.' },
            options: [
              { id: `${id}-two`, text: '2' },
              { id: `${id}-four`, text: '4' },
              { id: `${id}-five`, text: '5' },
              { id: `${id}-seven`, text: '7' },
            ],
          },
          {
            questionType: 'MULTIPLE_CHOICE',
            correctOptionIds: [`${id}-two`, `${id}-five`, `${id}-seven`],
          },
          id,
          questionId,
        ),
    },
    {
      name: 'TRUE_FALSE',
      create: (id: string, questionId: string) =>
        createSnapshot(
          QuestionType.TRUE_FALSE,
          AnswerFormat.BOOLEAN,
          {
            questionType: 'TRUE_FALSE',
            prompt: { text: 'The Earth orbits the Sun.' },
          },
          {
            questionType: 'TRUE_FALSE',
            correctValue: true,
          },
          id,
          questionId,
        ),
    },
    {
      name: 'SHORT_ANSWER',
      create: (id: string, questionId: string) =>
        createSnapshot(
          QuestionType.SHORT_ANSWER,
          AnswerFormat.SHORT_TEXT,
          {
            questionType: 'SHORT_ANSWER',
            prompt: {
              text: 'Name the process by which plants make food.',
            },
          },
          {
            questionType: 'SHORT_ANSWER',
            acceptedAnswers: ['Photosynthesis', 'photosynthesis'],
          },
          id,
          questionId,
        ),
    },
    {
      name: 'LONG_ANSWER',
      create: (id: string, questionId: string) =>
        createSnapshot(
          QuestionType.LONG_ANSWER,
          AnswerFormat.LONG_TEXT,
          {
            questionType: 'LONG_ANSWER',
            prompt: { text: 'Explain the water cycle.' },
          },
          {
            questionType: 'LONG_ANSWER',
            referenceAnswer:
              'The water cycle is the continuous movement of water through evaporation, condensation and precipitation.',
          },
          id,
          questionId,
        ),
    },
    {
      name: 'NUMERIC',
      create: (id: string, questionId: string) =>
        createSnapshot(
          QuestionType.NUMERIC,
          AnswerFormat.NUMBER,
          {
            questionType: 'NUMERIC',
            prompt: { text: 'What is 12 multiplied by 8?' },
            unit: null,
          },
          {
            questionType: 'NUMERIC',
            expectedValue: 96,
          },
          id,
          questionId,
        ),
    },
    {
      name: 'MATCHING',
      create: (id: string, questionId: string) =>
        createSnapshot(
          QuestionType.MATCHING,
          AnswerFormat.MATCHING_PAIRS,
          {
            questionType: 'MATCHING',
            matchingMode: 'MANY_TO_ONE',
            prompt: {
              text: 'Match each item with its category.',
            },
            leftItems: [
              { id: `${id}-rose`, text: 'Rose' },
              { id: `${id}-mango`, text: 'Mango' },
            ],
            rightItems: [
              { id: `${id}-plant`, text: 'Plant' },
              { id: `${id}-animal`, text: 'Animal' },
            ],
          },
          {
            questionType: 'MATCHING',
            correctPairs: [
              {
                leftItemId: `${id}-rose`,
                rightItemId: `${id}-plant`,
              },
              {
                leftItemId: `${id}-mango`,
                rightItemId: `${id}-plant`,
              },
            ],
          },
          id,
          questionId,
        ),
    },
    {
      name: 'ORDERING',
      create: (id: string, questionId: string) =>
        createSnapshot(
          QuestionType.ORDERING,
          AnswerFormat.ORDERED_ITEMS,
          {
            questionType: 'ORDERING',
            prompt: {
              text: 'Arrange the stages in the correct order.',
            },
            items: [
              { id: `${id}-stage-1`, text: 'Seed' },
              { id: `${id}-stage-2`, text: 'Seedling' },
              { id: `${id}-stage-3`, text: 'Mature plant' },
            ],
          },
          {
            questionType: 'ORDERING',
            correctOrderedItemIds: [
              `${id}-stage-1`,
              `${id}-stage-2`,
              `${id}-stage-3`,
            ],
          },
          id,
          questionId,
        ),
    },
    {
      name: 'FILL_IN_THE_BLANK',
      create: (id: string, questionId: string) =>
        createSnapshot(
          QuestionType.FILL_IN_THE_BLANK,
          AnswerFormat.BLANK_RESPONSES,
          {
            questionType: 'FILL_IN_THE_BLANK',
            prompt: {
              segments: [
                {
                  kind: 'TEXT',
                  text: 'The capital of France is ',
                },
                {
                  kind: 'BLANK',
                  blankId: `${id}-capital`,
                },
                {
                  kind: 'TEXT',
                  text: ' and the capital of Japan is ',
                },
                {
                  kind: 'BLANK',
                  blankId: `${id}-japan`,
                },
                {
                  kind: 'TEXT',
                  text: '.',
                },
              ],
            },
          },
          {
            questionType: 'FILL_IN_THE_BLANK',
            blanks: [
              {
                blankId: `${id}-capital`,
                acceptedAnswers: ['Paris'],
              },
              {
                blankId: `${id}-japan`,
                acceptedAnswers: ['Tokyo'],
              },
            ],
          },
          id,
          questionId,
        ),
    },
  ] as const;
}

describe('PrismaQuestionVersionRepository - PostgreSQL integration', () => {
  let prisma: PrismaService;
  let repository: PrismaQuestionVersionRepository;

  const createdQuestionIds = new Set<string>();

  beforeAll(async () => {
    prisma = new PrismaService();

    await prisma.$connect();

    repository = new PrismaQuestionVersionRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function createIdentity(label: string) {
    const suffix = `${suitePrefix}-${label}`;

    const questionId = `${suffix}-question`;

    createdQuestionIds.add(questionId);

    return {
      questionId,
      versionId: `${suffix}-version`,
    };
  }

  it.each(createFixtures())(
    'persists and hydrates the complete $name snapshot using PostgreSQL',
    async ({ name, create }) => {
      const identity = createIdentity(`type-${name.toLowerCase()}`);

      const original = create(identity.versionId, identity.questionId);

      await repository.add(original);

      const hydrated = await repository.findById(original.id);

      expect(hydrated).not.toBeNull();

      expect(hydrated?.id.value).toBe(original.id.value);
      expect(hydrated?.questionId.value).toBe(original.questionId.value);
      expect(hydrated?.versionNumber.value).toBe(1);
      expect(hydrated?.questionType).toBe(original.questionType);
      expect(hydrated?.answerFormat).toBe(original.answerFormat);
      expect(hydrated?.content).toEqual(original.content);
      expect(hydrated?.answerKey).toEqual(original.answerKey);

      expect(hydrated?.createdAt.toISOString()).toBe(
        original.createdAt.toISOString(),
      );

      const persistedVersion = await prisma.questionVersion.findUnique({
        where: {
          id: original.id.value,
        },
      });

      expect(persistedVersion).not.toBeNull();
      expect(persistedVersion?.completedAt).not.toBeNull();

      const contentCount = await prisma.questionVersionContent.count({
        where: {
          questionVersionId: original.id.value,
        },
      });

      const answerKeyCount = await prisma.questionVersionAnswerKey.count({
        where: {
          questionVersionId: original.id.value,
        },
      });

      expect(contentCount).toBe(1);
      expect(answerKeyCount).toBe(1);
    },
  );

  it('returns completed versions in ascending order and identifies the latest version', async () => {
    const identity = createIdentity('ordered-versions');

    const first = createFixtures()[2].create(
      `${identity.versionId}-1`,
      identity.questionId,
    );

    await repository.add(first);

    const second = createSnapshot(
      QuestionType.TRUE_FALSE,
      AnswerFormat.BOOLEAN,
      {
        questionType: 'TRUE_FALSE',
        prompt: {
          text: 'The Earth is approximately spherical.',
        },
      },
      {
        questionType: 'TRUE_FALSE',
        correctValue: true,
      },
      `${identity.versionId}-2`,
      identity.questionId,
      2,
      first,
    );

    await repository.add(second);

    const all = await repository.findAllByQuestionId(
      QuestionId.from(identity.questionId),
    );

    const latest = await repository.findLatestByQuestionId(
      QuestionId.from(identity.questionId),
    );

    expect(all).toHaveLength(2);
    expect(all.map((item) => item.versionNumber.value)).toEqual([1, 2]);

    expect(all[1]?.lineage.previousVersion?.id.value).toBe(first.id.value);

    expect(latest?.id.value).toBe(second.id.value);
    expect(latest?.versionNumber.value).toBe(2);
  });

  it('persists a restoration reference to an earlier version while retaining the immediate predecessor', async () => {
    const identity = createIdentity('restoration');

    const fixture = createFixtures()[2];

    const first = fixture.create(
      `${identity.versionId}-1`,
      identity.questionId,
    );

    await repository.add(first);

    const second = createSnapshot(
      QuestionType.TRUE_FALSE,
      AnswerFormat.BOOLEAN,
      {
        questionType: 'TRUE_FALSE',
        prompt: { text: 'The Moon orbits the Earth.' },
      },
      {
        questionType: 'TRUE_FALSE',
        correctValue: true,
      },
      `${identity.versionId}-2`,
      identity.questionId,
      2,
      first,
    );

    await repository.add(second);

    const third = createSnapshot(
      QuestionType.TRUE_FALSE,
      AnswerFormat.BOOLEAN,
      {
        questionType: 'TRUE_FALSE',
        prompt: { text: 'The Earth orbits the Sun.' },
      },
      {
        questionType: 'TRUE_FALSE',
        correctValue: true,
      },
      `${identity.versionId}-3`,
      identity.questionId,
      3,
      second,
      first,
    );

    await repository.add(third);

    const hydrated = await repository.findById(third.id);

    expect(hydrated?.lineage.previousVersion?.id.value).toBe(second.id.value);

    expect(hydrated?.lineage.restoredFromVersion?.id.value).toBe(
      first.id.value,
    );

    const persisted = await prisma.questionVersion.findUnique({
      where: {
        id: third.id.value,
      },
      select: {
        previousVersionId: true,
        restoredFromVersionId: true,
      },
    });

    expect(persisted?.previousVersionId).toBe(second.id.value);
    expect(persisted?.restoredFromVersionId).toBe(first.id.value);
  });

  it('rejects a duplicate version without changing the original completed snapshot', async () => {
    const identity = createIdentity('duplicate');

    const fixture = createFixtures()[2];

    const original = fixture.create(identity.versionId, identity.questionId);

    await repository.add(original);

    await expect(repository.add(original)).rejects.toMatchObject({
      name: 'PrismaRepositoryError',
    });

    const versions = await prisma.questionVersion.findMany({
      where: {
        questionId: identity.questionId,
      },
    });

    expect(versions).toHaveLength(1);
    expect(versions[0]?.id).toBe(original.id.value);
    expect(versions[0]?.completedAt).not.toBeNull();
  });

  it('serializes concurrent attempts to create the same next version', async () => {
    const identity = createIdentity('concurrent');

    const fixture = createFixtures()[2];

    const first = fixture.create(
      `${identity.versionId}-1`,
      identity.questionId,
    );

    await repository.add(first);

    const secondA = createSnapshot(
      QuestionType.TRUE_FALSE,
      AnswerFormat.BOOLEAN,
      {
        questionType: 'TRUE_FALSE',
        prompt: { text: 'Concurrent candidate A.' },
      },
      {
        questionType: 'TRUE_FALSE',
        correctValue: true,
      },
      `${identity.versionId}-2-a`,
      identity.questionId,
      2,
      first,
    );

    const secondB = createSnapshot(
      QuestionType.TRUE_FALSE,
      AnswerFormat.BOOLEAN,
      {
        questionType: 'TRUE_FALSE',
        prompt: { text: 'Concurrent candidate B.' },
      },
      {
        questionType: 'TRUE_FALSE',
        correctValue: false,
      },
      `${identity.versionId}-2-b`,
      identity.questionId,
      2,
      first,
    );

    const results = await Promise.allSettled([
      repository.add(secondA),
      repository.add(secondB),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');

    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const persisted = await prisma.questionVersion.findMany({
      where: {
        questionId: identity.questionId,
      },
      orderBy: {
        versionNumber: 'asc',
      },
    });

    expect(persisted).toHaveLength(2);
    expect(persisted.map((version) => version.versionNumber)).toEqual([1n, 2n]);

    expect(
      persisted.filter((version) => version.completedAt !== null),
    ).toHaveLength(2);
  });

  it('rejects an incomplete version at transaction commit through the deferred completion guard', async () => {
    const identity = createIdentity('completion-guard');

    await prisma.question.create({
      data: {
        id: identity.questionId,
      },
    });

    await expect(
      prisma.$transaction(async (transaction) => {
        await transaction.questionVersion.create({
          data: {
            id: identity.versionId,
            questionId: identity.questionId,
            versionNumber: 1n,
            questionType: 'TRUE_FALSE',
            answerFormat: 'BOOLEAN',
            previousVersionId: null,
            restoredFromVersionId: null,
            createdAt: CREATED_AT,
            completedAt: null,
          },
        });
      }),
    ).rejects.toThrow();

    const persisted = await prisma.questionVersion.findUnique({
      where: {
        id: identity.versionId,
      },
    });

    expect(persisted).toBeNull();
  });

  it('prevents modification of a completed snapshot and preserves its original content', async () => {
    const identity = createIdentity('immutable');

    const original = createFixtures()[2].create(
      identity.versionId,
      identity.questionId,
    );

    await repository.add(original);

    const before = await prisma.questionVersionContent.findUnique({
      where: {
        questionVersionId: original.id.value,
      },
    });

    expect(before).not.toBeNull();

    await expect(
      prisma.questionVersionContent.update({
        where: {
          questionVersionId: original.id.value,
        },
        data: {
          promptText: 'Attempted mutation after completion.',
        },
      }),
    ).rejects.toThrow();

    const after = await prisma.questionVersionContent.findUnique({
      where: {
        questionVersionId: original.id.value,
      },
    });

    expect(after?.promptText).toBe(before?.promptText);
  });

  it('checks existence using the persisted Question/version identity', async () => {
    const identity = createIdentity('exists');

    const original = createFixtures()[2].create(
      identity.versionId,
      identity.questionId,
    );

    await repository.add(original);

    await expect(
      repository.existsByQuestionIdAndVersion(
        QuestionId.from(identity.questionId),
        QuestionVersionNumber.initial(),
      ),
    ).resolves.toBe(true);

    await expect(
      repository.existsByQuestionIdAndVersion(
        QuestionId.from(identity.questionId),
        QuestionVersionNumber.from(2),
      ),
    ).resolves.toBe(false);
  });
});
