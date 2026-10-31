import { describe, expect, it } from 'vitest';

import {
  isQuestionType,
  QUESTION_TYPES,
  QuestionType,
} from './question-type.js';

describe('QuestionType', () => {
  it('defines exactly nine supported question types', () => {
    expect(QUESTION_TYPES).toHaveLength(9);
  });

  it('exposes the approved question types', () => {
    expect(QUESTION_TYPES).toEqual([
      'SINGLE_CHOICE',
      'MULTIPLE_CHOICE',
      'TRUE_FALSE',
      'SHORT_ANSWER',
      'LONG_ANSWER',
      'NUMERIC',
      'MATCHING',
      'ORDERING',
      'FILL_IN_THE_BLANK',
    ]);
  });

  it('provides stable named constants', () => {
    expect(QuestionType.SINGLE_CHOICE).toBe('SINGLE_CHOICE');
    expect(QuestionType.MULTIPLE_CHOICE).toBe('MULTIPLE_CHOICE');
    expect(QuestionType.TRUE_FALSE).toBe('TRUE_FALSE');
    expect(QuestionType.SHORT_ANSWER).toBe('SHORT_ANSWER');
    expect(QuestionType.LONG_ANSWER).toBe('LONG_ANSWER');
    expect(QuestionType.NUMERIC).toBe('NUMERIC');
    expect(QuestionType.MATCHING).toBe('MATCHING');
    expect(QuestionType.ORDERING).toBe('ORDERING');
    expect(QuestionType.FILL_IN_THE_BLANK).toBe('FILL_IN_THE_BLANK');
  });

  it.each(QUESTION_TYPES)(
    'recognizes %s as a supported question type',
    (questionType) => {
      expect(isQuestionType(questionType)).toBe(true);
    },
  );

  it.each([
    undefined,
    null,
    1,
    true,
    {},
    [],
    '',
    ' ',
    'single_choice',
    'ESSAY',
    'FILE_UPLOAD',
  ])('rejects unsupported question type values: %s', (value) => {
    expect(isQuestionType(value)).toBe(false);
  });

  it('does not expose a mutable question type collection', () => {
    expect(Object.isFrozen(QUESTION_TYPES)).toBe(true);
  });

  it('does not expose a mutable question type constant object', () => {
    expect(Object.isFrozen(QuestionType)).toBe(true);
  });
});
