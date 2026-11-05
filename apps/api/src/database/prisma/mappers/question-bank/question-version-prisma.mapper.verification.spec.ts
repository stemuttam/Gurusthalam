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
} from '@gurusthalam/question-bank';

import { QuestionVersionPrismaMapper } from './question-version-prisma.mapper.js';

function createMatchingSnapshot() {
  const id = QuestionVersionId.from('version-matching');
  const questionId = QuestionId.from('question-matching');
  const versionNumber = QuestionVersionNumber.initial();

  const current = QuestionVersionReference.create(
    id,
    questionId,
    versionNumber,
  );

  return createQuestionVersionSnapshot({
    id,
    questionId,
    versionNumber,
    questionType: QuestionType.MATCHING,
    answerFormat: AnswerFormat.MATCHING_PAIRS,
    content: {
      questionType: 'MATCHING',
      matchingMode: 'MANY_TO_ONE',
      prompt: { text: 'Match each item.' },
      leftItems: [
        { id: 'left-1', text: 'Rose' },
        { id: 'left-2', text: 'Mango' },
      ],
      rightItems: [
        { id: 'right-1', text: 'Plant' },
        { id: 'right-2', text: 'Animal' },
      ],
    },
    answerKey: {
      questionType: 'MATCHING',
      correctPairs: [
        { leftItemId: 'left-1', rightItemId: 'right-1' },
        { leftItemId: 'left-2', rightItemId: 'right-1' },
      ],
    },
    lineage: QuestionVersionLineage.create(current, null, null),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

function createFillBlankSnapshot() {
  const id = QuestionVersionId.from('version-fill-blank');
  const questionId = QuestionId.from('question-fill-blank');
  const versionNumber = QuestionVersionNumber.initial();

  const current = QuestionVersionReference.create(
    id,
    questionId,
    versionNumber,
  );

  return createQuestionVersionSnapshot({
    id,
    questionId,
    versionNumber,
    questionType: QuestionType.FILL_IN_THE_BLANK,
    answerFormat: AnswerFormat.BLANK_RESPONSES,
    content: {
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
    answerKey: {
      questionType: 'FILL_IN_THE_BLANK',
      blanks: [
        { blankId: 'capital', acceptedAnswers: ['Paris'] },
        { blankId: 'japan', acceptedAnswers: ['Tokyo'] },
      ],
    },
    lineage: QuestionVersionLineage.create(current, null, null),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('QuestionVersionPrismaMapper verification', () => {
  it('preserves matching item IDs, matching mode and repeated right-side mappings', () => {
    const snapshot = createMatchingSnapshot();

    const persisted = QuestionVersionPrismaMapper.toPersistence(snapshot);

    expect(persisted.version.content.matchingMode).toBe('MANY_TO_ONE');

    expect(
      persisted.version.content.matchingLeftItems.map((item) => item.id),
    ).toEqual(['left-1', 'left-2']);

    expect(
      persisted.version.content.matchingRightItems.map((item) => item.id),
    ).toEqual(['right-1', 'right-2']);

    expect(
      persisted.version.answerKey.matchingPairs.map(
        (pair) => pair.rightItemId,
      ),
    ).toEqual(['right-1', 'right-1']);

    expect(
      persisted.version.answerKey.matchingPairs.map(
        (pair) => pair.leftItemId,
      ),
    ).toEqual(['left-1', 'left-2']);
  });

  it('preserves fill-in-the-blank segment order and stable blank identifiers', () => {
    const snapshot = createFillBlankSnapshot();

    const persisted = QuestionVersionPrismaMapper.toPersistence(snapshot);

    expect(
      persisted.version.content.fillBlankSegments.map((segment) => ({
        kind: segment.kind,
        text: segment.text,
        blankId: segment.blankId,
        position: segment.position,
      })),
    ).toEqual([
      {
        kind: 'TEXT',
        text: 'The capital of France is ',
        blankId: null,
        position: 0,
      },
      {
        kind: 'BLANK',
        text: null,
        blankId: 'capital',
        position: 1,
      },
      {
        kind: 'TEXT',
        text: ' and the capital of Japan is ',
        blankId: null,
        position: 2,
      },
      {
        kind: 'BLANK',
        text: null,
        blankId: 'japan',
        position: 3,
      },
      {
        kind: 'TEXT',
        text: '.',
        blankId: null,
        position: 4,
      },
    ]);

    expect(
      persisted.version.answerKey.blankAnswers.map((answer) => ({
        blankSegmentId: answer.blankSegmentId,
        position: answer.position,
        acceptedAnswers: answer.acceptedAnswers.map(
          (accepted) => accepted.text,
        ),
      })),
    ).toEqual([
      {
        blankSegmentId: 'version-fill-blank:segment:1',
        position: 0,
        acceptedAnswers: ['Paris'],
      },
      {
        blankSegmentId: 'version-fill-blank:segment:3',
        position: 1,
        acceptedAnswers: ['Tokyo'],
      },
    ]);
  });

  it('generates deterministic infrastructure IDs for repeated mapping calls', () => {
    const snapshot = createFillBlankSnapshot();

    const first = QuestionVersionPrismaMapper.toPersistence(snapshot);
    const second = QuestionVersionPrismaMapper.toPersistence(snapshot);

    expect(first.version.content.id).toBe(second.version.content.id);
    expect(first.version.answerKey.id).toBe(second.version.answerKey.id);

    expect(
      first.version.content.fillBlankSegments.map((segment) => segment.id),
    ).toEqual(
      second.version.content.fillBlankSegments.map((segment) => segment.id),
    );

    expect(
      first.version.answerKey.blankAnswers.map(
        (answer) => answer.blankSegmentId,
      ),
    ).toEqual(
      second.version.answerKey.blankAnswers.map(
        (answer) => answer.blankSegmentId,
      ),
    );
  });

  it('does not mutate the original domain snapshot during persistence mapping', () => {
    const snapshot = createMatchingSnapshot();

    const originalContent = structuredClone(snapshot.content);
    const originalAnswerKey = structuredClone(snapshot.answerKey);

    QuestionVersionPrismaMapper.toPersistence(snapshot);

    expect(snapshot.content).toEqual(originalContent);
    expect(snapshot.answerKey).toEqual(originalAnswerKey);
  });
});