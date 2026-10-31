import { describe, expect, it } from 'vitest';

import {
  ANSWER_FORMATS,
  AnswerFormat,
  isAnswerFormat,
} from './answer-format.js';

describe('AnswerFormat', () => {
  it('defines exactly nine supported answer formats', () => {
    expect(ANSWER_FORMATS).toHaveLength(9);
  });

  it('exposes the approved answer formats', () => {
    expect(ANSWER_FORMATS).toEqual([
      'SELECTED_OPTION',
      'SELECTED_OPTIONS',
      'BOOLEAN',
      'SHORT_TEXT',
      'LONG_TEXT',
      'NUMBER',
      'MATCHING_PAIRS',
      'ORDERED_ITEMS',
      'BLANK_RESPONSES',
    ]);
  });

  it('provides stable named constants', () => {
    expect(AnswerFormat.SELECTED_OPTION).toBe('SELECTED_OPTION');
    expect(AnswerFormat.SELECTED_OPTIONS).toBe('SELECTED_OPTIONS');
    expect(AnswerFormat.BOOLEAN).toBe('BOOLEAN');
    expect(AnswerFormat.SHORT_TEXT).toBe('SHORT_TEXT');
    expect(AnswerFormat.LONG_TEXT).toBe('LONG_TEXT');
    expect(AnswerFormat.NUMBER).toBe('NUMBER');
    expect(AnswerFormat.MATCHING_PAIRS).toBe('MATCHING_PAIRS');
    expect(AnswerFormat.ORDERED_ITEMS).toBe('ORDERED_ITEMS');
    expect(AnswerFormat.BLANK_RESPONSES).toBe('BLANK_RESPONSES');
  });

  it.each(ANSWER_FORMATS)(
    'recognizes %s as a supported answer format',
    (answerFormat) => {
      expect(isAnswerFormat(answerFormat)).toBe(true);
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
    'TEXT',
    'FILE',
    'AUDIO',
    'VIDEO',
  ])('rejects unsupported answer format values: %s', (value) => {
    expect(isAnswerFormat(value)).toBe(false);
  });

  it('does not expose a mutable answer format collection', () => {
    expect(Object.isFrozen(ANSWER_FORMATS)).toBe(true);
  });

  it('does not expose a mutable answer format constant object', () => {
    expect(Object.isFrozen(AnswerFormat)).toBe(true);
  });
});
