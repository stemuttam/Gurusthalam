import { describe, expect, it } from 'vitest';

import { ANSWER_FORMATS, AnswerFormat } from '../answer-formats/index.js';
import { QUESTION_TYPES, QuestionType } from '../question-types/index.js';

import {
  getSupportedAnswerFormats,
  isSupportedAnswerFormat,
  QUESTION_ANSWER_COMPATIBILITY,
} from './question-answer-compatibility.js';

describe('Question-answer compatibility contract', () => {
  describe('compatibility mapping', () => {
    it('defines a compatibility entry for every supported question type', () => {
      expect(Object.keys(QUESTION_ANSWER_COMPATIBILITY).sort()).toEqual(
        [...QUESTION_TYPES].sort(),
      );
    });

    it('maps every approved question type to its approved answer format', () => {
      expect(QUESTION_ANSWER_COMPATIBILITY).toEqual({
        [QuestionType.SINGLE_CHOICE]: [AnswerFormat.SELECTED_OPTION],
        [QuestionType.MULTIPLE_CHOICE]: [AnswerFormat.SELECTED_OPTIONS],
        [QuestionType.TRUE_FALSE]: [AnswerFormat.BOOLEAN],
        [QuestionType.SHORT_ANSWER]: [AnswerFormat.SHORT_TEXT],
        [QuestionType.LONG_ANSWER]: [AnswerFormat.LONG_TEXT],
        [QuestionType.NUMERIC]: [AnswerFormat.NUMBER],
        [QuestionType.MATCHING]: [AnswerFormat.MATCHING_PAIRS],
        [QuestionType.ORDERING]: [AnswerFormat.ORDERED_ITEMS],
        [QuestionType.FILL_IN_THE_BLANK]: [AnswerFormat.BLANK_RESPONSES],
      });
    });

    it('does not leave any question type without a supported answer format', () => {
      for (const questionType of QUESTION_TYPES) {
        expect(
          QUESTION_ANSWER_COMPATIBILITY[questionType].length,
        ).toBeGreaterThan(0);
      }
    });

    it('does not reference unsupported answer formats', () => {
      const supportedFormats = new Set<string>(ANSWER_FORMATS);

      for (const questionType of QUESTION_TYPES) {
        for (const answerFormat of QUESTION_ANSWER_COMPATIBILITY[
          questionType
        ]) {
          expect(supportedFormats.has(answerFormat)).toBe(true);
        }
      }
    });

    it('freezes the compatibility mapping at runtime', () => {
      expect(Object.isFrozen(QUESTION_ANSWER_COMPATIBILITY)).toBe(true);
    });

    it('freezes every nested compatibility collection at runtime', () => {
      for (const questionType of QUESTION_TYPES) {
        expect(
          Object.isFrozen(QUESTION_ANSWER_COMPATIBILITY[questionType]),
        ).toBe(true);
      }
    });

    it('returns frozen collections through the public compatibility function', () => {
      for (const questionType of QUESTION_TYPES) {
        expect(Object.isFrozen(getSupportedAnswerFormats(questionType))).toBe(
          true,
        );
      }
    });
  });

  describe('getSupportedAnswerFormats', () => {
    it.each([
      [QuestionType.SINGLE_CHOICE, [AnswerFormat.SELECTED_OPTION]],
      [QuestionType.MULTIPLE_CHOICE, [AnswerFormat.SELECTED_OPTIONS]],
      [QuestionType.TRUE_FALSE, [AnswerFormat.BOOLEAN]],
      [QuestionType.SHORT_ANSWER, [AnswerFormat.SHORT_TEXT]],
      [QuestionType.LONG_ANSWER, [AnswerFormat.LONG_TEXT]],
      [QuestionType.NUMERIC, [AnswerFormat.NUMBER]],
      [QuestionType.MATCHING, [AnswerFormat.MATCHING_PAIRS]],
      [QuestionType.ORDERING, [AnswerFormat.ORDERED_ITEMS]],
      [QuestionType.FILL_IN_THE_BLANK, [AnswerFormat.BLANK_RESPONSES]],
    ] as const)(
      'returns the supported answer format for %s',
      (questionType, expectedFormats) => {
        expect(getSupportedAnswerFormats(questionType)).toEqual(
          expectedFormats,
        );
      },
    );

    it.each([
      ['undefined', undefined],
      ['null', null],
      ['empty string', ''],
      ['whitespace string', '   '],
      ['unsupported string', 'ESSAY'],
      ['number', 42],
      ['boolean', true],
      ['object', {}],
      ['array', []],
      ['symbol', Symbol('question-type')],
    ])('throws TypeError for an unsupported question type: %s', (_, value) => {
      expect(() => getSupportedAnswerFormats(value)).toThrowError(TypeError);

      expect(() => getSupportedAnswerFormats(value)).toThrowError(
        'Cannot retrieve supported answer formats for an unsupported question type.',
      );
    });
  });

  describe('isSupportedAnswerFormat', () => {
    it.each(QUESTION_TYPES)(
      'accepts the configured answer format for %s',
      (questionType) => {
        const supportedFormats = getSupportedAnswerFormats(questionType);

        for (const answerFormat of supportedFormats) {
          expect(isSupportedAnswerFormat(questionType, answerFormat)).toBe(
            true,
          );
        }
      },
    );

    it('rejects a multiple-choice answer format for a single-choice question', () => {
      expect(
        isSupportedAnswerFormat(
          QuestionType.SINGLE_CHOICE,
          AnswerFormat.SELECTED_OPTIONS,
        ),
      ).toBe(false);
    });

    it('rejects a boolean answer format for a numeric question', () => {
      expect(
        isSupportedAnswerFormat(QuestionType.NUMERIC, AnswerFormat.BOOLEAN),
      ).toBe(false);
    });

    it('rejects a long-text answer format for a short-answer question', () => {
      expect(
        isSupportedAnswerFormat(
          QuestionType.SHORT_ANSWER,
          AnswerFormat.LONG_TEXT,
        ),
      ).toBe(false);
    });

    it('rejects an ordering answer format for a matching question', () => {
      expect(
        isSupportedAnswerFormat(
          QuestionType.MATCHING,
          AnswerFormat.ORDERED_ITEMS,
        ),
      ).toBe(false);
    });

    it('rejects a blank-response answer format for a true-false question', () => {
      expect(
        isSupportedAnswerFormat(
          QuestionType.TRUE_FALSE,
          AnswerFormat.BLANK_RESPONSES,
        ),
      ).toBe(false);
    });

    it.each([
      ['undefined', undefined],
      ['null', null],
      ['empty string', ''],
      ['whitespace string', '   '],
      ['unsupported string', 'ESSAY'],
      ['number', 42],
      ['boolean', true],
      ['object', {}],
      ['array', []],
      ['symbol', Symbol('question-type')],
    ])(
      'returns false for an unsupported question type: %s',
      (_, questionType) => {
        expect(
          isSupportedAnswerFormat(questionType, AnswerFormat.SELECTED_OPTION),
        ).toBe(false);
      },
    );

    it.each([
      ['undefined', undefined],
      ['null', null],
      ['empty string', ''],
      ['whitespace string', '   '],
      ['unsupported string', 'RICH_MEDIA'],
      ['number', 42],
      ['boolean', true],
      ['object', {}],
      ['array', []],
      ['symbol', Symbol('answer-format')],
    ])(
      'returns false for an unsupported answer format: %s',
      (_, answerFormat) => {
        expect(
          isSupportedAnswerFormat(QuestionType.SINGLE_CHOICE, answerFormat),
        ).toBe(false);
      },
    );

    it('returns false when both question type and answer format are invalid', () => {
      expect(isSupportedAnswerFormat(undefined, undefined)).toBe(false);
      expect(isSupportedAnswerFormat(null, null)).toBe(false);
      expect(isSupportedAnswerFormat({}, [])).toBe(false);
    });

    it('does not throw for malformed runtime values', () => {
      const malformedValues: unknown[] = [
        undefined,
        null,
        '',
        'INVALID',
        0,
        42,
        true,
        false,
        {},
        [],
        Symbol('invalid'),
      ];

      for (const value of malformedValues) {
        expect(() =>
          isSupportedAnswerFormat(value, AnswerFormat.SELECTED_OPTION),
        ).not.toThrow();

        expect(() =>
          isSupportedAnswerFormat(QuestionType.SINGLE_CHOICE, value),
        ).not.toThrow();
      }
    });
  });
});
