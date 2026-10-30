import { describe, expect, it } from 'vitest';

import { AssessmentId } from './assessment-id.js';

describe('AssessmentId', () => {
  describe('generation', () => {
    it('generates an AssessmentId instance', () => {
      const id = AssessmentId.generate();

      expect(id).toBeInstanceOf(AssessmentId);
    });

    it('generates a non-empty primitive identifier', () => {
      const id = AssessmentId.generate();

      expect(id.value).toBeTypeOf('string');
      expect(id.value.length).toBeGreaterThan(0);
    });

    it('generates distinct identifiers', () => {
      const first = AssessmentId.generate();
      const second = AssessmentId.generate();

      expect(first.equals(second)).toBe(false);
      expect(first.value).not.toBe(second.value);
    });

    it('generates UUID-shaped identifiers', () => {
      const id = AssessmentId.generate();

      expect(id.value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });
  });

  describe('rehydration', () => {
    it('rehydrates a valid opaque identifier', () => {
      const id = AssessmentId.from('assessment-123');

      expect(id.value).toBe('assessment-123');
      expect(id.toString()).toBe('assessment-123');
    });

    it('preserves the exact canonical primitive value', () => {
      const value = 'assessment-2026-001';
      const id = AssessmentId.from(value);

      expect(id.value).toBe(value);
      expect(id.toString()).toBe(value);
    });

    it('accepts a UUID as an opaque identifier', () => {
      const value = '550e8400-e29b-41d4-a716-446655440000';
      const id = AssessmentId.from(value);

      expect(id.value).toBe(value);
    });

    it('rejects an empty identifier', () => {
      expect(() => AssessmentId.from('')).toThrow(
        'AssessmentId must be a non-empty string.',
      );
    });

    it('rejects a whitespace-only identifier', () => {
      expect(() => AssessmentId.from('   ')).toThrow(
        'AssessmentId must be a non-empty string.',
      );
    });

    it('rejects leading whitespace', () => {
      expect(() => AssessmentId.from(' assessment-123')).toThrow(
        'AssessmentId must not contain leading or trailing whitespace.',
      );
    });

    it('rejects trailing whitespace', () => {
      expect(() => AssessmentId.from('assessment-123 ')).toThrow(
        'AssessmentId must not contain leading or trailing whitespace.',
      );
    });

    it('rejects surrounding whitespace', () => {
      expect(() => AssessmentId.from(' assessment-123 ')).toThrow(
        'AssessmentId must not contain leading or trailing whitespace.',
      );
    });
  });

  describe('primitive validation', () => {
    it('accepts a canonical non-empty string', () => {
      expect(AssessmentId.isValid('assessment-123')).toBe(true);
    });

    it('accepts UUID strings', () => {
      expect(AssessmentId.isValid('550e8400-e29b-41d4-a716-446655440000')).toBe(
        true,
      );
    });

    it('rejects an empty string', () => {
      expect(AssessmentId.isValid('')).toBe(false);
    });

    it('rejects whitespace-only strings', () => {
      expect(AssessmentId.isValid('   ')).toBe(false);
    });

    it('rejects leading whitespace', () => {
      expect(AssessmentId.isValid(' assessment-123')).toBe(false);
    });

    it('rejects trailing whitespace', () => {
      expect(AssessmentId.isValid('assessment-123 ')).toBe(false);
    });

    it('rejects non-string values', () => {
      expect(AssessmentId.isValid(null)).toBe(false);
      expect(AssessmentId.isValid(undefined)).toBe(false);
      expect(AssessmentId.isValid(123)).toBe(false);
      expect(AssessmentId.isValid({})).toBe(false);
      expect(AssessmentId.isValid([])).toBe(false);
    });
  });

  describe('value equality', () => {
    it('compares identifiers by value', () => {
      const first = AssessmentId.from('assessment-123');
      const second = AssessmentId.from('assessment-123');
      const third = AssessmentId.from('assessment-456');

      expect(first.equals(second)).toBe(true);
      expect(first.equals(third)).toBe(false);
    });

    it('does not confuse distinct instances with identity equality', () => {
      const first = AssessmentId.from('assessment-123');
      const second = AssessmentId.from('assessment-123');

      expect(first).not.toBe(second);
      expect(first.equals(second)).toBe(true);
    });

    it('is reflexive', () => {
      const id = AssessmentId.from('assessment-123');

      expect(id.equals(id)).toBe(true);
    });

    it('is symmetric for equal values', () => {
      const first = AssessmentId.from('assessment-123');
      const second = AssessmentId.from('assessment-123');

      expect(first.equals(second)).toBe(true);
      expect(second.equals(first)).toBe(true);
    });

    it('does not equal an identifier with a different value', () => {
      const first = AssessmentId.from('assessment-123');
      const second = AssessmentId.from('assessment-124');

      expect(first.equals(second)).toBe(false);
    });
  });

  describe('immutability', () => {
    it('freezes the AssessmentId instance', () => {
      const id = AssessmentId.from('assessment-123');

      expect(Object.isFrozen(id)).toBe(true);
    });

    it('keeps the primitive value stable', () => {
      const id = AssessmentId.from('assessment-123');
      const originalValue = id.value;

      expect(id.value).toBe(originalValue);
      expect(id.toString()).toBe(originalValue);
    });
  });
});
