import { describe, expect, it } from 'vitest';

import * as QuestionBankPublicApi from './index.js';

describe('Question Bank public API contract', () => {
  describe('Question identity exports', () => {
    it('exports QuestionId', () => {
      expect(QuestionBankPublicApi.QuestionId).toBeDefined();
      expect(typeof QuestionBankPublicApi.QuestionId.generate).toBe('function');
      expect(typeof QuestionBankPublicApi.QuestionId.from).toBe('function');
      expect(typeof QuestionBankPublicApi.QuestionId.isValid).toBe('function');
    });

    it('supports identity generation through the public entry point', () => {
      const id = QuestionBankPublicApi.QuestionId.generate();

      expect(id).toBeInstanceOf(QuestionBankPublicApi.QuestionId);
      expect(QuestionBankPublicApi.QuestionId.isValid(id.toString())).toBe(
        true,
      );
    });

    it('supports identity rehydration through the public entry point', () => {
      const id = QuestionBankPublicApi.QuestionId.from(
        'public-api-question-001',
      );

      expect(id.toString()).toBe('public-api-question-001');
    });

    it('preserves identity value equality through the public entry point', () => {
      const first = QuestionBankPublicApi.QuestionId.from(
        'public-api-question-001',
      );
      const second = QuestionBankPublicApi.QuestionId.from(
        'public-api-question-001',
      );

      expect(first.equals(second)).toBe(true);
    });
  });

  describe('Question type public API', () => {
    it('exports the complete question type taxonomy', () => {
      expect(QuestionBankPublicApi.QUESTION_TYPES).toHaveLength(9);
      expect(QuestionBankPublicApi.QuestionType).toBeDefined();
    });

    it('exports the question type runtime guard', () => {
      expect(
        QuestionBankPublicApi.isQuestionType(
          QuestionBankPublicApi.QuestionType.SINGLE_CHOICE,
        ),
      ).toBe(true);

      expect(QuestionBankPublicApi.isQuestionType('UNSUPPORTED')).toBe(false);
    });
  });

  describe('Answer format public API', () => {
    it('exports the complete answer format taxonomy', () => {
      expect(QuestionBankPublicApi.ANSWER_FORMATS).toHaveLength(9);
      expect(QuestionBankPublicApi.AnswerFormat).toBeDefined();
    });

    it('exports the answer format runtime guard', () => {
      expect(
        QuestionBankPublicApi.isAnswerFormat(
          QuestionBankPublicApi.AnswerFormat.SELECTED_OPTION,
        ),
      ).toBe(true);

      expect(QuestionBankPublicApi.isAnswerFormat('UNSUPPORTED')).toBe(false);
    });
  });

  describe('Question-answer compatibility public API', () => {
    it('exports the compatibility contract', () => {
      expect(QuestionBankPublicApi.QUESTION_ANSWER_COMPATIBILITY).toBeDefined();
    });

    it('exposes supported formats through the public entry point', () => {
      expect(
        QuestionBankPublicApi.getSupportedAnswerFormats(
          QuestionBankPublicApi.QuestionType.SINGLE_CHOICE,
        ),
      ).toEqual([QuestionBankPublicApi.AnswerFormat.SELECTED_OPTION]);
    });

    it('validates compatible question and answer combinations', () => {
      expect(
        QuestionBankPublicApi.isSupportedAnswerFormat(
          QuestionBankPublicApi.QuestionType.MULTIPLE_CHOICE,
          QuestionBankPublicApi.AnswerFormat.SELECTED_OPTIONS,
        ),
      ).toBe(true);
    });

    it('rejects incompatible question and answer combinations', () => {
      expect(
        QuestionBankPublicApi.isSupportedAnswerFormat(
          QuestionBankPublicApi.QuestionType.SINGLE_CHOICE,
          QuestionBankPublicApi.AnswerFormat.SELECTED_OPTIONS,
        ),
      ).toBe(false);
    });
  });
});
