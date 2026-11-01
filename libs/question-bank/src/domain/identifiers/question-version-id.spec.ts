import { describe, expect, it } from 'vitest';

import { QuestionId } from './question-id.js';
import { QuestionVersionId } from './question-version-id.js';

describe('QuestionVersionId', () => {
  describe('generation', () => {
    it('generates a QuestionVersionId instance', () => {
      const id = QuestionVersionId.generate();

      expect(id).toBeInstanceOf(QuestionVersionId);
    });

    it('generates a non-empty primitive identifier', () => {
      const id = QuestionVersionId.generate();

      expect(id.value).toBeTypeOf('string');
      expect(id.value.length).toBeGreaterThan(0);
    });

    it('generates distinct identifiers', () => {
      const first = QuestionVersionId.generate();
      const second = QuestionVersionId.generate();

      expect(first.equals(second)).toBe(false);
      expect(first.value).not.toBe(second.value);
    });

    it('generates UUID-shaped identifiers', () => {
      const id = QuestionVersionId.generate();

      expect(id.value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });
  });

  describe('rehydration', () => {
    it('rehydrates a valid opaque identifier', () => {
      const id = QuestionVersionId.from('question-version-123');

      expect(id.value).toBe('question-version-123');
      expect(id.toString()).toBe('question-version-123');
    });

    it('preserves the exact canonical primitive value', () => {
      const value = 'question-version-2026-001';
      const id = QuestionVersionId.from(value);

      expect(id.value).toBe(value);
      expect(id.toString()).toBe(value);
    });

    it('accepts a UUID as an opaque identifier', () => {
      const value = '550e8400-e29b-41d4-a716-446655440000';
      const id = QuestionVersionId.from(value);

      expect(id.value).toBe(value);
    });

    it('does not require UUID syntax for existing identifiers', () => {
      const values = [
        'question-version-001',
        'question-bank:version:2026:001',
        'legacy_question_version_123',
      ];

      for (const value of values) {
        expect(QuestionVersionId.from(value).toString()).toBe(value);
      }
    });

    it('rejects an empty identifier', () => {
      expect(() => QuestionVersionId.from('')).toThrow(
        'QuestionVersionId must be a non-empty string.',
      );
    });

    it('rejects a whitespace-only identifier', () => {
      expect(() => QuestionVersionId.from('   ')).toThrow(
        'QuestionVersionId must be a non-empty string.',
      );
    });

    it('rejects leading whitespace', () => {
      expect(() => QuestionVersionId.from(' question-version-123')).toThrow(
        'QuestionVersionId must not contain leading or trailing whitespace.',
      );
    });

    it('rejects trailing whitespace', () => {
      expect(() => QuestionVersionId.from('question-version-123 ')).toThrow(
        'QuestionVersionId must not contain leading or trailing whitespace.',
      );
    });

    it('rejects surrounding whitespace', () => {
      expect(() => QuestionVersionId.from(' question-version-123 ')).toThrow(
        'QuestionVersionId must not contain leading or trailing whitespace.',
      );
    });

    it('does not silently normalize a non-canonical identifier', () => {
      const value = ' question-version-123 ';

      expect(() => QuestionVersionId.from(value)).toThrow();
    });
  });

  describe('primitive validation', () => {
    it('accepts a canonical non-empty string', () => {
      expect(QuestionVersionId.isValid('question-version-123')).toBe(true);
    });

    it('accepts UUID strings', () => {
      expect(
        QuestionVersionId.isValid('550e8400-e29b-41d4-a716-446655440000'),
      ).toBe(true);
    });

    it('rejects an empty string', () => {
      expect(QuestionVersionId.isValid('')).toBe(false);
    });

    it('rejects whitespace-only strings', () => {
      expect(QuestionVersionId.isValid('   ')).toBe(false);
    });

    it('rejects leading whitespace', () => {
      expect(QuestionVersionId.isValid(' question-version-123')).toBe(false);
    });

    it('rejects trailing whitespace', () => {
      expect(QuestionVersionId.isValid('question-version-123 ')).toBe(false);
    });

    it('rejects non-string values', () => {
      expect(QuestionVersionId.isValid(null)).toBe(false);
      expect(QuestionVersionId.isValid(undefined)).toBe(false);
      expect(QuestionVersionId.isValid(123)).toBe(false);
      expect(QuestionVersionId.isValid({})).toBe(false);
      expect(QuestionVersionId.isValid([])).toBe(false);
    });
  });

  describe('value equality', () => {
    it('compares identifiers by primitive value', () => {
      const first = QuestionVersionId.from('question-version-123');
      const second = QuestionVersionId.from('question-version-123');
      const third = QuestionVersionId.from('question-version-456');

      expect(first.equals(second)).toBe(true);
      expect(first.equals(third)).toBe(false);
    });

    it('does not rely on object reference equality', () => {
      const first = QuestionVersionId.from('question-version-123');
      const second = QuestionVersionId.from('question-version-123');

      expect(first).not.toBe(second);
      expect(first.equals(second)).toBe(true);
    });

    it('is reflexive', () => {
      const id = QuestionVersionId.from('question-version-123');

      expect(id.equals(id)).toBe(true);
    });

    it('is symmetric for equal values', () => {
      const first = QuestionVersionId.from('question-version-123');
      const second = QuestionVersionId.from('question-version-123');

      expect(first.equals(second)).toBe(true);
      expect(second.equals(first)).toBe(true);
    });

    it('does not equal an identifier with a different value', () => {
      const first = QuestionVersionId.from('question-version-123');
      const second = QuestionVersionId.from('question-version-124');

      expect(first.equals(second)).toBe(false);
    });
  });

  describe('bounded-context and identity isolation', () => {
    it('does not treat a QuestionId as a QuestionVersionId', () => {
      const versionId = QuestionVersionId.from('shared-identifier');
      const questionId = QuestionId.from('shared-identifier');

      expect(versionId.equals(questionId as unknown as QuestionVersionId)).toBe(
        false,
      );
    });

    it('does not treat a structural lookalike as a QuestionVersionId', () => {
      const versionId = QuestionVersionId.from('shared-identifier');
      const otherIdentity = {
        value: 'shared-identifier',
      };

      expect(versionId.equals(otherIdentity as QuestionVersionId)).toBe(false);
    });

    it('keeps QuestionId and QuestionVersionId as separate domain identities', () => {
      const questionId = QuestionId.from('question-001');
      const versionId = QuestionVersionId.from('question-001');

      expect(questionId).toBeInstanceOf(QuestionId);
      expect(versionId).toBeInstanceOf(QuestionVersionId);
      expect(questionId).not.toBeInstanceOf(QuestionVersionId);
      expect(versionId).not.toBeInstanceOf(QuestionId);
    });
  });

  describe('immutability', () => {
    it('freezes the QuestionVersionId instance', () => {
      const id = QuestionVersionId.from('question-version-123');

      expect(Object.isFrozen(id)).toBe(true);
    });

    it('keeps the primitive value stable', () => {
      const id = QuestionVersionId.from('question-version-123');
      const originalValue = id.value;

      expect(id.value).toBe(originalValue);
      expect(id.toString()).toBe(originalValue);
    });
  });
});
