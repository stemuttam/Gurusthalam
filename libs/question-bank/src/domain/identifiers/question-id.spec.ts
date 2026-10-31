import { describe, expect, it } from 'vitest';

import { QuestionId } from './question-id.js';

describe('QuestionId', () => {
  describe('generation', () => {
    it('generates a QuestionId instance', () => {
      const id = QuestionId.generate();

      expect(id).toBeInstanceOf(QuestionId);
    });

    it('generates a non-empty primitive identifier', () => {
      const id = QuestionId.generate();

      expect(id.value).toBeTypeOf('string');
      expect(id.value.length).toBeGreaterThan(0);
    });

    it('generates distinct identifiers', () => {
      const first = QuestionId.generate();
      const second = QuestionId.generate();

      expect(first.equals(second)).toBe(false);
      expect(first.value).not.toBe(second.value);
    });

    it('generates UUID-shaped identifiers', () => {
      const id = QuestionId.generate();

      expect(id.value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });
  });

  describe('rehydration', () => {
    it('rehydrates a valid opaque identifier', () => {
      const id = QuestionId.from('question-123');

      expect(id.value).toBe('question-123');
      expect(id.toString()).toBe('question-123');
    });

    it('preserves the exact canonical primitive value', () => {
      const value = 'question-2026-001';
      const id = QuestionId.from(value);

      expect(id.value).toBe(value);
      expect(id.toString()).toBe(value);
    });

    it('accepts a UUID as an opaque identifier', () => {
      const value = '550e8400-e29b-41d4-a716-446655440000';
      const id = QuestionId.from(value);

      expect(id.value).toBe(value);
    });

    it('does not require UUID syntax for existing identifiers', () => {
      const values = [
        'question-001',
        'question-bank:item:2026:001',
        'legacy_question_123',
      ];

      for (const value of values) {
        expect(QuestionId.from(value).toString()).toBe(value);
      }
    });

    it('rejects an empty identifier', () => {
      expect(() => QuestionId.from('')).toThrow(
        'QuestionId must be a non-empty string.',
      );
    });

    it('rejects a whitespace-only identifier', () => {
      expect(() => QuestionId.from('   ')).toThrow(
        'QuestionId must be a non-empty string.',
      );
    });

    it('rejects leading whitespace', () => {
      expect(() => QuestionId.from(' question-123')).toThrow(
        'QuestionId must not contain leading or trailing whitespace.',
      );
    });

    it('rejects trailing whitespace', () => {
      expect(() => QuestionId.from('question-123 ')).toThrow(
        'QuestionId must not contain leading or trailing whitespace.',
      );
    });

    it('rejects surrounding whitespace', () => {
      expect(() => QuestionId.from(' question-123 ')).toThrow(
        'QuestionId must not contain leading or trailing whitespace.',
      );
    });

    it('does not silently normalize a non-canonical identifier', () => {
      const value = ' question-123 ';

      expect(() => QuestionId.from(value)).toThrow();
    });
  });

  describe('primitive validation', () => {
    it('accepts a canonical non-empty string', () => {
      expect(QuestionId.isValid('question-123')).toBe(true);
    });

    it('accepts UUID strings', () => {
      expect(QuestionId.isValid('550e8400-e29b-41d4-a716-446655440000')).toBe(
        true,
      );
    });

    it('rejects an empty string', () => {
      expect(QuestionId.isValid('')).toBe(false);
    });

    it('rejects whitespace-only strings', () => {
      expect(QuestionId.isValid('   ')).toBe(false);
    });

    it('rejects leading whitespace', () => {
      expect(QuestionId.isValid(' question-123')).toBe(false);
    });

    it('rejects trailing whitespace', () => {
      expect(QuestionId.isValid('question-123 ')).toBe(false);
    });

    it('rejects non-string values', () => {
      expect(QuestionId.isValid(null)).toBe(false);
      expect(QuestionId.isValid(undefined)).toBe(false);
      expect(QuestionId.isValid(123)).toBe(false);
      expect(QuestionId.isValid({})).toBe(false);
      expect(QuestionId.isValid([])).toBe(false);
    });
  });

  describe('value equality', () => {
    it('compares identifiers by primitive value', () => {
      const first = QuestionId.from('question-123');
      const second = QuestionId.from('question-123');
      const third = QuestionId.from('question-456');

      expect(first.equals(second)).toBe(true);
      expect(first.equals(third)).toBe(false);
    });

    it('does not rely on object reference equality', () => {
      const first = QuestionId.from('question-123');
      const second = QuestionId.from('question-123');

      expect(first).not.toBe(second);
      expect(first.equals(second)).toBe(true);
    });

    it('is reflexive', () => {
      const id = QuestionId.from('question-123');

      expect(id.equals(id)).toBe(true);
    });

    it('is symmetric for equal values', () => {
      const first = QuestionId.from('question-123');
      const second = QuestionId.from('question-123');

      expect(first.equals(second)).toBe(true);
      expect(second.equals(first)).toBe(true);
    });

    it('does not equal an identifier with a different value', () => {
      const first = QuestionId.from('question-123');
      const second = QuestionId.from('question-124');

      expect(first.equals(second)).toBe(false);
    });
  });

  describe('immutability', () => {
    it('freezes the QuestionId instance', () => {
      const id = QuestionId.from('question-123');

      expect(Object.isFrozen(id)).toBe(true);
    });

    it('keeps the primitive value stable', () => {
      const id = QuestionId.from('question-123');
      const originalValue = id.value;

      expect(id.value).toBe(originalValue);
      expect(id.toString()).toBe(originalValue);
    });
  });

  describe('bounded-context isolation', () => {
    it('does not treat an AssessmentId instance as a QuestionId', () => {
      const questionId = QuestionId.from('shared-identifier');
      const otherIdentity = {
        value: 'shared-identifier',
      };

      expect(questionId.equals(otherIdentity as QuestionId)).toBe(false);
    });
  });
});
