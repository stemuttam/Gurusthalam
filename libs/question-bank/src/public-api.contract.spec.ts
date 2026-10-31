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
});
