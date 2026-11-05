import { describe, expect, it } from 'vitest';
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
} from '@gurusthalam/question-bank';

import {
  QuestionVersionPrismaMapper,
  type PrismaQuestionVersionPersistence,
  type PrismaQuestionVersionRecord,
} from './question-version-prisma.mapper.js';

const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');

function createSnapshot(
  questionType: QuestionType,
  answerFormat: AnswerFormat,
  content: AnyQuestionVersionSnapshotInput['content'],
  answerKey: AnyQuestionVersionSnapshotInput['answerKey'],
  id = `version-${questionType.toLowerCase()}`,
  questionId = `question-${questionType.toLowerCase()}`,
) {
  const versionId = QuestionVersionId.from(id);
  const aggregateId = QuestionId.from(questionId);
  const versionNumber = QuestionVersionNumber.initial();

  const current = QuestionVersionReference.create(
    versionId,
    aggregateId,
    versionNumber,
  );

  return createQuestionVersionSnapshot({
    id: versionId,
    questionId: aggregateId,
    versionNumber,
    questionType,
    answerFormat,
    content,
    answerKey,
    lineage: QuestionVersionLineage.create(current, null, null),
    createdAt: CREATED_AT,
  } as AnyQuestionVersionSnapshotInput);
}

/**
 * Converts the normalized mapper output into the relation-hydrated projection
 * consumed by toDomain().
 *
 * This adapter exists only in tests. It deliberately does not represent a
 * Prisma nested-create input or a production repository implementation.
 */
function persistenceToRecord(
  persistence: PrismaQuestionVersionPersistence,
): PrismaQuestionVersionRecord {
  const version = persistence.version;
  const content = version.content;
  const answerKey = version.answerKey;

  const fillBlankSegments = content.fillBlankSegments.map((segment) => ({
    id: segment.id,
    kind: segment.kind,
    text: segment.text,
    blankId: segment.blankId,
    position: segment.position,
  }));

  const blankAnswers = answerKey.blankAnswers.map((blankAnswer) => {
    const segment = fillBlankSegments.find(
      (candidate) => candidate.id === blankAnswer.blankSegmentId,
    );

    if (!segment) {
      throw new Error(
        `Test adapter could not find fill-blank segment ${blankAnswer.blankSegmentId}.`,
      );
    }

    return {
      blankSegment: {
        blankId: segment.blankId,
      },
      acceptedAnswers: blankAnswer.acceptedAnswers.map((answer) => ({
        text: answer.text,
        position: answer.position,
      })),
      position: blankAnswer.position,
    };
  });

  return {
    id: version.id,
    questionId: version.questionId,
    versionNumber: version.versionNumber,
    questionType: version.questionType,
    answerFormat: version.answerFormat,
    previousVersionId: version.previousVersionId,
    restoredFromVersionId: version.restoredFromVersionId,
    createdAt: new Date(version.createdAt),
    previousVersion: null,
    restoredFrom: null,
    content: {
      id: content.id,
      questionVersionId: content.questionVersionId,
      questionType: content.questionType,
      promptText: content.promptText,
      numericUnit: content.numericUnit,
      matchingMode: content.matchingMode,
      options: content.options.map((row) => ({ ...row })),
      matchingLeftItems: content.matchingLeftItems.map((row) => ({
        ...row,
      })),
      matchingRightItems: content.matchingRightItems.map((row) => ({
        ...row,
      })),
      orderingItems: content.orderingItems.map((row) => ({ ...row })),
      fillBlankSegments,
    },
    answerKey: {
      id: answerKey.id,
      questionVersionId: answerKey.questionVersionId,
      questionType: answerKey.questionType,
      correctBoolean: answerKey.correctBoolean,
      expectedNumericValue: answerKey.expectedNumericValue,
      referenceAnswer: answerKey.referenceAnswer,
      optionAnswers: answerKey.optionAnswers.map((row) => ({ ...row })),
      acceptedAnswers: answerKey.acceptedAnswers.map((row) => ({
        text: row.text,
        position: row.position,
      })),
      matchingPairs: answerKey.matchingPairs.map((row) => ({ ...row })),
      orderingAnswers: answerKey.orderingAnswers.map((row) => ({ ...row })),
      blankAnswers,
    },
  };
}

const fixtures = [
  {
    name: 'SINGLE_CHOICE',
    create: () =>
      createSnapshot(
        QuestionType.SINGLE_CHOICE,
        AnswerFormat.SELECTED_OPTION,
        {
          questionType: 'SINGLE_CHOICE',
          prompt: { text: 'Which planet is known as the Red Planet?' },
          options: [
            { id: 'mars', text: 'Mars' },
            { id: 'venus', text: 'Venus' },
            { id: 'jupiter', text: 'Jupiter' },
          ],
        },
        {
          questionType: 'SINGLE_CHOICE',
          correctOptionId: 'mars',
        },
      ),
  },
  {
    name: 'MULTIPLE_CHOICE',
    create: () =>
      createSnapshot(
        QuestionType.MULTIPLE_CHOICE,
        AnswerFormat.SELECTED_OPTIONS,
        {
          questionType: 'MULTIPLE_CHOICE',
          prompt: { text: 'Select the prime numbers.' },
          options: [
            { id: 'two', text: '2' },
            { id: 'four', text: '4' },
            { id: 'five', text: '5' },
            { id: 'seven', text: '7' },
          ],
        },
        {
          questionType: 'MULTIPLE_CHOICE',
          correctOptionIds: ['two', 'five', 'seven'],
        },
      ),
  },
  {
    name: 'TRUE_FALSE',
    create: () =>
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
      ),
  },
  {
    name: 'SHORT_ANSWER',
    create: () =>
      createSnapshot(
        QuestionType.SHORT_ANSWER,
        AnswerFormat.SHORT_TEXT,
        {
          questionType: 'SHORT_ANSWER',
          prompt: { text: 'Name the process by which plants make food.' },
        },
        {
          questionType: 'SHORT_ANSWER',
          acceptedAnswers: ['Photosynthesis', 'photosynthesis'],
        },
      ),
  },
  {
    name: 'LONG_ANSWER',
    create: () =>
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
      ),
  },
  {
    name: 'NUMERIC',
    create: () =>
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
      ),
  },
  {
    name: 'MATCHING',
    create: () =>
      createSnapshot(
        QuestionType.MATCHING,
        AnswerFormat.MATCHING_PAIRS,
        {
          questionType: 'MATCHING',
          matchingMode: 'MANY_TO_ONE',
          prompt: { text: 'Match each item with its category.' },
          leftItems: [
            { id: 'rose', text: 'Rose' },
            { id: 'mango', text: 'Mango' },
          ],
          rightItems: [
            { id: 'plant', text: 'Plant' },
            { id: 'animal', text: 'Animal' },
          ],
        },
        {
          questionType: 'MATCHING',
          correctPairs: [
            { leftItemId: 'rose', rightItemId: 'plant' },
            { leftItemId: 'mango', rightItemId: 'plant' },
          ],
        },
      ),
  },
  {
    name: 'ORDERING',
    create: () =>
      createSnapshot(
        QuestionType.ORDERING,
        AnswerFormat.ORDERED_ITEMS,
        {
          questionType: 'ORDERING',
          prompt: { text: 'Arrange the stages in the correct order.' },
          items: [
            { id: 'stage-1', text: 'Seed' },
            { id: 'stage-2', text: 'Seedling' },
            { id: 'stage-3', text: 'Mature plant' },
          ],
        },
        {
          questionType: 'ORDERING',
          correctOrderedItemIds: ['stage-1', 'stage-2', 'stage-3'],
        },
      ),
  },
  {
    name: 'FILL_IN_THE_BLANK',
    create: () =>
      createSnapshot(
        QuestionType.FILL_IN_THE_BLANK,
        AnswerFormat.BLANK_RESPONSES,
        {
          questionType: 'FILL_IN_THE_BLANK',
          prompt: {
            segments: [
              { kind: 'TEXT', text: 'The capital of France is ' },
              { kind: 'BLANK', blankId: 'capital' },
              { kind: 'TEXT', text: ' and the capital of Japan is ' },
              { kind: 'BLANK', blankId: 'japan' },
              { kind: 'TEXT', text: '.' },
            ],
          },
        },
        {
          questionType: 'FILL_IN_THE_BLANK',
          blanks: [
            {
              blankId: 'capital',
              acceptedAnswers: ['Paris'],
            },
            {
              blankId: 'japan',
              acceptedAnswers: ['Tokyo'],
            },
          ],
        },
      ),
  },
] as const;

describe('QuestionVersionPrismaMapper', () => {
  describe('nine question-type round trips', () => {
    it.each(fixtures)(
      'round-trips $name through persistence and domain hydration',
      ({ create }) => {
        const original = create();

        const persistence = QuestionVersionPrismaMapper.toPersistence(original);

        expect(persistence.question.id).toBe(original.questionId.value);
        expect(persistence.version.id).toBe(original.id.value);
        expect(persistence.version.versionNumber).toBe(1n);

        const hydrated = persistenceToRecord(persistence);
        const restored = QuestionVersionPrismaMapper.toDomain(hydrated);

        expect(restored.id.value).toBe(original.id.value);
        expect(restored.questionId.value).toBe(original.questionId.value);
        expect(restored.versionNumber.value).toBe(original.versionNumber.value);
        expect(restored.questionType).toBe(original.questionType);
        expect(restored.answerFormat).toBe(original.answerFormat);
        expect(restored.content).toEqual(original.content);
        expect(restored.answerKey).toEqual(original.answerKey);
        expect(restored.createdAt.toISOString()).toBe(
          original.createdAt.toISOString(),
        );
      },
    );
  });

  it('preserves an empty SHORT_ANSWER accepted-answer collection', () => {
    const value = createSnapshot(
      QuestionType.SHORT_ANSWER,
      AnswerFormat.SHORT_TEXT,
      {
        questionType: 'SHORT_ANSWER',
        prompt: { text: 'Answer briefly.' },
      },
      {
        questionType: 'SHORT_ANSWER',
        acceptedAnswers: [],
      },
      'version-short-empty',
      'question-short-empty',
    );

    const persistence = QuestionVersionPrismaMapper.toPersistence(value);

    expect(persistence.version.answerKey.acceptedAnswers).toEqual([]);

    const restored = QuestionVersionPrismaMapper.toDomain(
      persistenceToRecord(persistence),
    );

    expect(restored.answerKey).toEqual(value.answerKey);
  });

  it('rejects a persisted version number outside the safe integer range', () => {
    const valid = QuestionVersionPrismaMapper.toPersistence(
      fixtures[2].create(),
    );
    const record = persistenceToRecord(valid);

    const invalidRecord: PrismaQuestionVersionRecord = {
      ...record,
      versionNumber: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
    };

    expect(() => QuestionVersionPrismaMapper.toDomain(invalidRecord)).toThrow(
      /safe-integer range/,
    );
  });

  it('rejects non-contiguous persisted child positions', () => {
    const valid = QuestionVersionPrismaMapper.toPersistence(
      fixtures[0].create(),
    );
    const record = persistenceToRecord(valid);

    if (record.content === null || record.content === undefined) {
      throw new Error('Expected persisted question content.');
    }

    const invalidRecord: PrismaQuestionVersionRecord = {
      ...record,
      content: {
        ...record.content,
        options: [
          { id: 'option-a', text: 'A', position: 0 },
          { id: 'option-b', text: 'B', position: 2 },
        ],
      },
    };

    expect(() => QuestionVersionPrismaMapper.toDomain(invalidRecord)).toThrow(
      /contiguous/,
    );
  });

  it('rejects a content relation owned by another version', () => {
    const persistence = QuestionVersionPrismaMapper.toPersistence(
      fixtures[2].create(),
    );
    const record = persistenceToRecord(persistence);

    if (record.content === null || record.content === undefined) {
      throw new Error('Expected persisted question content.');
    }

    const invalidRecord: PrismaQuestionVersionRecord = {
      ...record,
      content: {
        ...record.content,
        questionVersionId: 'another-version',
      },
    };

    expect(() => QuestionVersionPrismaMapper.toDomain(invalidRecord)).toThrow(
      /belongs to another version/,
    );
  });

  it('rejects an answer-key relation owned by another version', () => {
    const persistence = QuestionVersionPrismaMapper.toPersistence(
      fixtures[2].create(),
    );
    const record = persistenceToRecord(persistence);

    if (record.answerKey === null || record.answerKey === undefined) {
      throw new Error('Expected persisted question answer key.');
    }

    const invalidRecord: PrismaQuestionVersionRecord = {
      ...record,
      answerKey: {
        ...record.answerKey,
        questionVersionId: 'another-version',
      },
    };

    expect(() => QuestionVersionPrismaMapper.toDomain(invalidRecord)).toThrow(
      /belongs to another version/,
    );
  });

  it('rejects content and answer-key discriminator mismatches', () => {
    const persistence = QuestionVersionPrismaMapper.toPersistence(
      fixtures[2].create(),
    );
    const record = persistenceToRecord(persistence);

    if (record.answerKey === null || record.answerKey === undefined) {
      throw new Error('Expected persisted question answer key.');
    }

    const invalidRecord: PrismaQuestionVersionRecord = {
      ...record,
      answerKey: {
        ...record.answerKey,
        questionType: 'SHORT_ANSWER',
      },
    };

    expect(() => QuestionVersionPrismaMapper.toDomain(invalidRecord)).toThrow(
      /discriminator/,
    );
  });

  it('rejects an invalid creation timestamp', () => {
    const persistence = QuestionVersionPrismaMapper.toPersistence(
      fixtures[2].create(),
    );
    const record = persistenceToRecord(persistence);

    const invalidRecord: PrismaQuestionVersionRecord = {
      ...record,
      createdAt: new Date(Number.NaN),
    };

    expect(() => QuestionVersionPrismaMapper.toDomain(invalidRecord)).toThrow(
      /createdAt/,
    );
  });

  it('rejects missing content relations', () => {
    const persistence = QuestionVersionPrismaMapper.toPersistence(
      fixtures[2].create(),
    );
    const record = persistenceToRecord(persistence);

    const invalidRecord: PrismaQuestionVersionRecord = {
      ...record,
      content: null,
    };

    expect(() => QuestionVersionPrismaMapper.toDomain(invalidRecord)).toThrow(
      /must have content/,
    );
  });

  it('rejects missing answer-key relations', () => {
    const persistence = QuestionVersionPrismaMapper.toPersistence(
      fixtures[2].create(),
    );
    const record = persistenceToRecord(persistence);

    const invalidRecord: PrismaQuestionVersionRecord = {
      ...record,
      answerKey: null,
    };

    expect(() => QuestionVersionPrismaMapper.toDomain(invalidRecord)).toThrow(
      /answer key/,
    );
  });
});
