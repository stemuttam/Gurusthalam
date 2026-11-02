import { describe, expect, it } from 'vitest';

import { AnswerFormat } from '../answer-formats/answer-format.js';
import { QuestionId } from '../identifiers/question-id.js';
import { QuestionVersionId } from '../identifiers/question-version-id.js';
import { QuestionVersionNumber } from '../identifiers/question-version-number.js';
import { QuestionType } from '../question-types/question-type.js';
import type { AnyQuestionVersionSnapshotInput } from './question-version-snapshot.js';
import { createQuestionVersionSnapshot } from './question-version-snapshot.js';
import { QuestionVersionLineage } from './question-version-lineage.js';
import { QuestionVersionReference } from './question-version-reference.js';

function createBaseIdentity(versionNumber = 1) {
  const id = QuestionVersionId.generate();
  const questionId = QuestionId.generate();
  const number = QuestionVersionNumber.from(versionNumber);

  const current = QuestionVersionReference.create(id, questionId, number);

  const previous =
    versionNumber === 1
      ? null
      : QuestionVersionReference.create(
          QuestionVersionId.generate(),
          questionId,
          QuestionVersionNumber.from(versionNumber - 1),
        );

  const lineage = QuestionVersionLineage.create(current, previous);

  return {
    id,
    questionId,
    versionNumber: number,
    lineage,
  };
}

function makeInput(
  questionType: QuestionType,
  content: unknown,
  answerKey: unknown,
  answerFormat: AnswerFormat,
  versionNumber = 1,
): AnyQuestionVersionSnapshotInput {
  const identity = createBaseIdentity(versionNumber);

  return {
    ...identity,
    questionType,
    answerFormat,
    content,
    answerKey,
    createdAt: new Date('2026-11-02T10:00:00.000Z'),
  } as unknown as AnyQuestionVersionSnapshotInput;
}

describe('QuestionVersionSnapshot factory', () => {
  it('creates an immutable single-choice snapshot', () => {
    const input = makeInput(
      QuestionType.SINGLE_CHOICE,
      {
        questionType: QuestionType.SINGLE_CHOICE,
        prompt: { text: 'Choose one.' },
        options: [
          { id: 'a', text: 'Option A' },
          { id: 'b', text: 'Option B' },
        ],
      },
      {
        questionType: QuestionType.SINGLE_CHOICE,
        correctOptionId: 'b',
      },
      AnswerFormat.SELECTED_OPTION,
    );

    const snapshot = createQuestionVersionSnapshot(input);

    const content = snapshot.content as {
      readonly options: readonly Readonly<{
        id: string;
        text: string;
      }>[];
    };

    expect(snapshot.questionType).toBe(QuestionType.SINGLE_CHOICE);

    expect(snapshot.answerKey).toEqual({
      questionType: QuestionType.SINGLE_CHOICE,
      correctOptionId: 'b',
    });

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.content)).toBe(true);
    expect(Object.isFrozen(content.options)).toBe(true);
    expect(Object.isFrozen(content.options[0])).toBe(true);
  });

  it('creates a multiple-choice snapshot', () => {
    const input = makeInput(
      QuestionType.MULTIPLE_CHOICE,
      {
        questionType: QuestionType.MULTIPLE_CHOICE,
        prompt: { text: 'Choose all that apply.' },
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
          { id: 'c', text: 'C' },
        ],
      },
      {
        questionType: QuestionType.MULTIPLE_CHOICE,
        correctOptionIds: ['a', 'c'],
      },
      AnswerFormat.SELECTED_OPTIONS,
    );

    const snapshot = createQuestionVersionSnapshot(input);

    expect(snapshot.answerKey).toEqual({
      questionType: QuestionType.MULTIPLE_CHOICE,
      correctOptionIds: ['a', 'c'],
    });
  });

  it('creates a true-false snapshot', () => {
    const input = makeInput(
      QuestionType.TRUE_FALSE,
      {
        questionType: QuestionType.TRUE_FALSE,
        prompt: { text: 'The statement is true.' },
      },
      {
        questionType: QuestionType.TRUE_FALSE,
        correctValue: true,
      },
      AnswerFormat.BOOLEAN,
    );

    expect(createQuestionVersionSnapshot(input).answerKey).toEqual({
      questionType: QuestionType.TRUE_FALSE,
      correctValue: true,
    });
  });

  it('creates a short-answer snapshot', () => {
    const input = makeInput(
      QuestionType.SHORT_ANSWER,
      {
        questionType: QuestionType.SHORT_ANSWER,
        prompt: { text: 'Give a short answer.' },
      },
      {
        questionType: QuestionType.SHORT_ANSWER,
        acceptedAnswers: ['Answer A', 'Answer B'],
      },
      AnswerFormat.SHORT_TEXT,
    );

    expect(createQuestionVersionSnapshot(input).questionType).toBe(
      QuestionType.SHORT_ANSWER,
    );
  });

  it('creates a long-answer snapshot', () => {
    const input = makeInput(
      QuestionType.LONG_ANSWER,
      {
        questionType: QuestionType.LONG_ANSWER,
        prompt: { text: 'Explain your answer.' },
      },
      {
        questionType: QuestionType.LONG_ANSWER,
        referenceAnswer: 'A reference response.',
      },
      AnswerFormat.LONG_TEXT,
    );

    expect(createQuestionVersionSnapshot(input).answerKey).toEqual({
      questionType: QuestionType.LONG_ANSWER,
      referenceAnswer: 'A reference response.',
    });
  });

  it('creates a numeric snapshot', () => {
    const input = makeInput(
      QuestionType.NUMERIC,
      {
        questionType: QuestionType.NUMERIC,
        prompt: { text: 'Calculate the value.' },
        unit: 'cm',
      },
      {
        questionType: QuestionType.NUMERIC,
        expectedValue: 12.5,
      },
      AnswerFormat.NUMBER,
    );

    expect(createQuestionVersionSnapshot(input).answerKey).toEqual({
      questionType: QuestionType.NUMERIC,
      expectedValue: 12.5,
    });
  });

  it('creates a matching snapshot when every pair references existing items', () => {
    const input = makeInput(
      QuestionType.MATCHING,
      {
        questionType: QuestionType.MATCHING,
        prompt: { text: 'Match the items.' },
        leftItems: [
          { id: 'l1', text: 'Left 1' },
          { id: 'l2', text: 'Left 2' },
        ],
        rightItems: [
          { id: 'r1', text: 'Right 1' },
          { id: 'r2', text: 'Right 2' },
        ],
      },
      {
        questionType: QuestionType.MATCHING,
        correctPairs: [
          { leftItemId: 'l1', rightItemId: 'r2' },
          { leftItemId: 'l2', rightItemId: 'r1' },
        ],
      },
      AnswerFormat.MATCHING_PAIRS,
    );

    expect(createQuestionVersionSnapshot(input).questionType).toBe(
      QuestionType.MATCHING,
    );
  });

  it('creates an ordering snapshot when every item appears exactly once', () => {
    const input = makeInput(
      QuestionType.ORDERING,
      {
        questionType: QuestionType.ORDERING,
        prompt: { text: 'Put these in order.' },
        items: [
          { id: 'first', text: 'First' },
          { id: 'second', text: 'Second' },
          { id: 'third', text: 'Third' },
        ],
      },
      {
        questionType: QuestionType.ORDERING,
        correctOrderedItemIds: ['second', 'first', 'third'],
      },
      AnswerFormat.ORDERED_ITEMS,
    );

    expect(createQuestionVersionSnapshot(input).answerKey).toEqual({
      questionType: QuestionType.ORDERING,
      correctOrderedItemIds: ['second', 'first', 'third'],
    });
  });

  it('creates a fill-in-the-blank snapshot when every blank has one answer-key entry', () => {
    const input = makeInput(
      QuestionType.FILL_IN_THE_BLANK,
      {
        questionType: QuestionType.FILL_IN_THE_BLANK,
        prompt: {
          segments: [
            { kind: 'TEXT', text: 'The ' },
            { kind: 'BLANK', blankId: 'b1' },
            { kind: 'TEXT', text: ' is blue.' },
            { kind: 'BLANK', blankId: 'b2' },
          ],
        },
      },
      {
        questionType: QuestionType.FILL_IN_THE_BLANK,
        blanks: [
          { blankId: 'b1', acceptedAnswers: ['sky'] },
          { blankId: 'b2', acceptedAnswers: ['ocean'] },
        ],
      },
      AnswerFormat.BLANK_RESPONSES,
    );

    expect(createQuestionVersionSnapshot(input).questionType).toBe(
      QuestionType.FILL_IN_THE_BLANK,
    );
  });

  it('rejects a content discriminator that differs from the snapshot type', () => {
    const input = makeInput(
      QuestionType.SINGLE_CHOICE,
      {
        questionType: QuestionType.MULTIPLE_CHOICE,
        prompt: { text: 'Choose.' },
        options: [{ id: 'a', text: 'A' }],
      },
      {
        questionType: QuestionType.SINGLE_CHOICE,
        correctOptionId: 'a',
      },
      AnswerFormat.SELECTED_OPTION,
    );

    expect(() => createQuestionVersionSnapshot(input)).toThrow(TypeError);
  });

  it('rejects an answer-key discriminator that differs from the snapshot type', () => {
    const input = makeInput(
      QuestionType.SINGLE_CHOICE,
      {
        questionType: QuestionType.SINGLE_CHOICE,
        prompt: { text: 'Choose.' },
        options: [{ id: 'a', text: 'A' }],
      },
      {
        questionType: QuestionType.MULTIPLE_CHOICE,
        correctOptionIds: ['a'],
      },
      AnswerFormat.SELECTED_OPTION,
    );

    expect(() => createQuestionVersionSnapshot(input)).toThrow(TypeError);
  });

  it('rejects an incompatible answer format', () => {
    const input = makeInput(
      QuestionType.SINGLE_CHOICE,
      {
        questionType: QuestionType.SINGLE_CHOICE,
        prompt: { text: 'Choose.' },
        options: [{ id: 'a', text: 'A' }],
      },
      {
        questionType: QuestionType.SINGLE_CHOICE,
        correctOptionId: 'a',
      },
      AnswerFormat.SELECTED_OPTIONS,
    );

    expect(() => createQuestionVersionSnapshot(input)).toThrow(
      'Snapshot answerFormat is not compatible with its questionType.',
    );
  });

  it('rejects a lineage whose current version does not match snapshot identity', () => {
    const input = makeInput(
      QuestionType.TRUE_FALSE,
      {
        questionType: QuestionType.TRUE_FALSE,
        prompt: { text: 'True?' },
      },
      {
        questionType: QuestionType.TRUE_FALSE,
        correctValue: true,
      },
      AnswerFormat.BOOLEAN,
    );

    const otherCurrent = QuestionVersionReference.create(
      QuestionVersionId.generate(),
      input.questionId,
      input.versionNumber,
    );

    const invalidInput = {
      ...input,
      lineage: QuestionVersionLineage.create(otherCurrent),
    } as AnyQuestionVersionSnapshotInput;

    expect(() => createQuestionVersionSnapshot(invalidInput)).toThrow(
      'Snapshot identity must match the current version in its lineage.',
    );
  });

  it('rejects a single-choice answer key referencing an unknown option', () => {
    const input = makeInput(
      QuestionType.SINGLE_CHOICE,
      {
        questionType: QuestionType.SINGLE_CHOICE,
        prompt: { text: 'Choose.' },
        options: [{ id: 'a', text: 'A' }],
      },
      {
        questionType: QuestionType.SINGLE_CHOICE,
        correctOptionId: 'missing',
      },
      AnswerFormat.SELECTED_OPTION,
    );

    expect(() => createQuestionVersionSnapshot(input)).toThrow(
      'answerKey.correctOptionId references an unknown ID: missing.',
    );
  });

  it('rejects multiple-choice answer keys containing unknown option IDs', () => {
    const input = makeInput(
      QuestionType.MULTIPLE_CHOICE,
      {
        questionType: QuestionType.MULTIPLE_CHOICE,
        prompt: { text: 'Choose.' },
        options: [{ id: 'a', text: 'A' }],
      },
      {
        questionType: QuestionType.MULTIPLE_CHOICE,
        correctOptionIds: ['a', 'missing'],
      },
      AnswerFormat.SELECTED_OPTIONS,
    );

    expect(() => createQuestionVersionSnapshot(input)).toThrow(
      'answerKey.correctOptionIds references an unknown ID: missing.',
    );
  });

  it('rejects duplicate multiple-choice answer IDs', () => {
    const input = makeInput(
      QuestionType.MULTIPLE_CHOICE,
      {
        questionType: QuestionType.MULTIPLE_CHOICE,
        prompt: { text: 'Choose.' },
        options: [{ id: 'a', text: 'A' }],
      },
      {
        questionType: QuestionType.MULTIPLE_CHOICE,
        correctOptionIds: ['a', 'a'],
      },
      AnswerFormat.SELECTED_OPTIONS,
    );

    expect(() => createQuestionVersionSnapshot(input)).toThrow(
      'answerKey.correctOptionIds must be unique.',
    );
  });

  it('rejects matching pairs that reference unknown left items', () => {
    const input = makeInput(
      QuestionType.MATCHING,
      {
        questionType: QuestionType.MATCHING,
        prompt: { text: 'Match.' },
        leftItems: [{ id: 'l1', text: 'Left' }],
        rightItems: [{ id: 'r1', text: 'Right' }],
      },
      {
        questionType: QuestionType.MATCHING,
        correctPairs: [{ leftItemId: 'missing', rightItemId: 'r1' }],
      },
      AnswerFormat.MATCHING_PAIRS,
    );

    expect(() => createQuestionVersionSnapshot(input)).toThrow(
      'answerKey.correctPairs.leftItemId references an unknown ID: missing.',
    );
  });

  it('rejects matching pairs that reference unknown right items', () => {
    const input = makeInput(
      QuestionType.MATCHING,
      {
        questionType: QuestionType.MATCHING,
        prompt: { text: 'Match.' },
        leftItems: [{ id: 'l1', text: 'Left' }],
        rightItems: [{ id: 'r1', text: 'Right' }],
      },
      {
        questionType: QuestionType.MATCHING,
        correctPairs: [{ leftItemId: 'l1', rightItemId: 'missing' }],
      },
      AnswerFormat.MATCHING_PAIRS,
    );

    expect(() => createQuestionVersionSnapshot(input)).toThrow(
      'answerKey.correctPairs.rightItemId references an unknown ID: missing.',
    );
  });

  it('rejects an ordering key with missing content items', () => {
    const input = makeInput(
      QuestionType.ORDERING,
      {
        questionType: QuestionType.ORDERING,
        prompt: { text: 'Order.' },
        items: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
        ],
      },
      {
        questionType: QuestionType.ORDERING,
        correctOrderedItemIds: ['a'],
      },
      AnswerFormat.ORDERED_ITEMS,
    );

    expect(() => createQuestionVersionSnapshot(input)).toThrow(
      'answerKey.correctOrderedItemIds must contain every content item exactly once.',
    );
  });

  it('rejects an ordering key with duplicate item IDs', () => {
    const input = makeInput(
      QuestionType.ORDERING,
      {
        questionType: QuestionType.ORDERING,
        prompt: { text: 'Order.' },
        items: [{ id: 'a', text: 'A' }],
      },
      {
        questionType: QuestionType.ORDERING,
        correctOrderedItemIds: ['a', 'a'],
      },
      AnswerFormat.ORDERED_ITEMS,
    );

    expect(() => createQuestionVersionSnapshot(input)).toThrow(
      'answerKey.correctOrderedItemIds must be unique.',
    );
  });

  it('rejects fill-in-the-blank keys that omit a content blank', () => {
    const input = makeInput(
      QuestionType.FILL_IN_THE_BLANK,
      {
        questionType: QuestionType.FILL_IN_THE_BLANK,
        prompt: {
          segments: [
            { kind: 'BLANK', blankId: 'b1' },
            { kind: 'BLANK', blankId: 'b2' },
          ],
        },
      },
      {
        questionType: QuestionType.FILL_IN_THE_BLANK,
        blanks: [{ blankId: 'b1', acceptedAnswers: ['one'] }],
      },
      AnswerFormat.BLANK_RESPONSES,
    );

    expect(() => createQuestionVersionSnapshot(input)).toThrow(
      'answerKey.blanks must correspond to every content blank exactly once.',
    );
  });

  it('rejects duplicate content option IDs', () => {
    const input = makeInput(
      QuestionType.SINGLE_CHOICE,
      {
        questionType: QuestionType.SINGLE_CHOICE,
        prompt: { text: 'Choose.' },
        options: [
          { id: 'a', text: 'A' },
          { id: 'a', text: 'Another A' },
        ],
      },
      {
        questionType: QuestionType.SINGLE_CHOICE,
        correctOptionId: 'a',
      },
      AnswerFormat.SELECTED_OPTION,
    );

    expect(() => createQuestionVersionSnapshot(input)).toThrow(
      'content.options IDs must be unique.',
    );
  });

  it('defensively copies input content and answer-key arrays', () => {
    const options = [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
    ];

    const correctOptionIds = ['a'];

    const input = makeInput(
      QuestionType.MULTIPLE_CHOICE,
      {
        questionType: QuestionType.MULTIPLE_CHOICE,
        prompt: { text: 'Choose.' },
        options,
      },
      {
        questionType: QuestionType.MULTIPLE_CHOICE,
        correctOptionIds,
      },
      AnswerFormat.SELECTED_OPTIONS,
    );

    const snapshot = createQuestionVersionSnapshot(input);

    const firstOption = options[0];

    if (firstOption === undefined) {
      throw new Error('Expected at least one question option.');
    }

    firstOption.text = 'Changed';
    correctOptionIds.push('b');

    const content = snapshot.content as {
      readonly options: readonly Readonly<{
        id: string;
        text: string;
      }>[];
    };

    const answerKey = snapshot.answerKey as {
      readonly correctOptionIds: readonly string[];
    };

    expect(content.options[0]?.text).toBe('A');
    expect(answerKey.correctOptionIds).toEqual(['a']);
  });

  it('returns a defensive Date copy on every createdAt read', () => {
    const input = makeInput(
      QuestionType.TRUE_FALSE,
      {
        questionType: QuestionType.TRUE_FALSE,
        prompt: { text: 'True?' },
      },
      {
        questionType: QuestionType.TRUE_FALSE,
        correctValue: true,
      },
      AnswerFormat.BOOLEAN,
    );

    const snapshot = createQuestionVersionSnapshot(input);
    const firstRead = snapshot.createdAt;

    firstRead.setUTCFullYear(2000);

    expect(snapshot.createdAt.toISOString()).toBe('2026-11-02T10:00:00.000Z');

    expect(snapshot.createdAt).not.toBe(firstRead);
  });

  it('rejects an invalid creation date', () => {
    const input = {
      ...makeInput(
        QuestionType.TRUE_FALSE,
        {
          questionType: QuestionType.TRUE_FALSE,
          prompt: { text: 'True?' },
        },
        {
          questionType: QuestionType.TRUE_FALSE,
          correctValue: true,
        },
        AnswerFormat.BOOLEAN,
      ),
      createdAt: new Date(Number.NaN),
    } as AnyQuestionVersionSnapshotInput;

    expect(() => createQuestionVersionSnapshot(input)).toThrow(
      'Snapshot createdAt must be a valid Date.',
    );
  });

  it('rejects non-finite numeric answer keys', () => {
    const input = makeInput(
      QuestionType.NUMERIC,
      {
        questionType: QuestionType.NUMERIC,
        prompt: { text: 'Calculate.' },
        unit: null,
      },
      {
        questionType: QuestionType.NUMERIC,
        expectedValue: Number.NaN,
      },
      AnswerFormat.NUMBER,
    );

    expect(() => createQuestionVersionSnapshot(input)).toThrow(
      'answerKey.expectedValue must be a finite number.',
    );
  });
});
