import { describe, expect, it } from 'vitest';

import { CourseId } from './course-id.js';

describe('CourseId', () => {
  describe('generation', () => {
    it('generates a CourseId instance', () => {
      const id = CourseId.generate();

      expect(id).toBeInstanceOf(CourseId);
    });

    it('generates a non-empty primitive identifier', () => {
      const id = CourseId.generate();

      expect(id.value).toBeTypeOf('string');
      expect(id.value.length).toBeGreaterThan(0);
    });

    it('generates distinct identifiers', () => {
      const first = CourseId.generate();
      const second = CourseId.generate();

      expect(first.equals(second)).toBe(false);
      expect(first.value).not.toBe(second.value);
    });

    it('generates UUID-shaped identifiers', () => {
      const id = CourseId.generate();

      expect(id.value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });
  });

  describe('rehydration', () => {
    it('rehydrates a valid opaque identifier', () => {
      const id = CourseId.from('course-123');

      expect(id.value).toBe('course-123');
      expect(id.toString()).toBe('course-123');
    });

    it('preserves the exact canonical primitive value', () => {
      const value = 'course-2026-001';
      const id = CourseId.from(value);

      expect(id.value).toBe(value);
      expect(id.toString()).toBe(value);
    });

    it('rejects an empty identifier', () => {
      expect(() => CourseId.from('')).toThrow(
        'CourseId must be a non-empty string.',
      );
    });

    it('rejects a whitespace-only identifier', () => {
      expect(() => CourseId.from('   ')).toThrow(
        'CourseId must be a non-empty string.',
      );
    });

    it('rejects leading whitespace', () => {
      expect(() => CourseId.from(' course-123')).toThrow(
        'CourseId must not contain leading or trailing whitespace.',
      );
    });

    it('rejects trailing whitespace', () => {
      expect(() => CourseId.from('course-123 ')).toThrow(
        'CourseId must not contain leading or trailing whitespace.',
      );
    });

    it('rejects surrounding whitespace', () => {
      expect(() => CourseId.from(' course-123 ')).toThrow(
        'CourseId must not contain leading or trailing whitespace.',
      );
    });
  });

  describe('primitive validation', () => {
    it('accepts a canonical non-empty string', () => {
      expect(CourseId.isValid('course-123')).toBe(true);
    });

    it('accepts UUID strings', () => {
      expect(
        CourseId.isValid(
          '550e8400-e29b-41d4-a716-446655440000',
        ),
      ).toBe(true);
    });

    it('rejects an empty string', () => {
      expect(CourseId.isValid('')).toBe(false);
    });

    it('rejects whitespace-only strings', () => {
      expect(CourseId.isValid('   ')).toBe(false);
    });

    it('rejects leading whitespace', () => {
      expect(CourseId.isValid(' course-123')).toBe(false);
    });

    it('rejects trailing whitespace', () => {
      expect(CourseId.isValid('course-123 ')).toBe(false);
    });

    it('rejects non-string values', () => {
      expect(CourseId.isValid(null)).toBe(false);
      expect(CourseId.isValid(undefined)).toBe(false);
      expect(CourseId.isValid(123)).toBe(false);
      expect(CourseId.isValid({})).toBe(false);
      expect(CourseId.isValid([])).toBe(false);
    });
  });

  describe('value equality', () => {
    it('compares identifiers by value', () => {
      const first = CourseId.from('course-123');
      const second = CourseId.from('course-123');
      const third = CourseId.from('course-456');

      expect(first.equals(second)).toBe(true);
      expect(first.equals(third)).toBe(false);
    });

    it('does not confuse distinct identifier instances with identity equality', () => {
      const first = CourseId.from('course-123');
      const second = CourseId.from('course-123');

      expect(first).not.toBe(second);
      expect(first.equals(second)).toBe(true);
    });

    it('is reflexive', () => {
      const id = CourseId.from('course-123');

      expect(id.equals(id)).toBe(true);
    });

    it('is symmetric for equal values', () => {
      const first = CourseId.from('course-123');
      const second = CourseId.from('course-123');

      expect(first.equals(second)).toBe(true);
      expect(second.equals(first)).toBe(true);
    });

    it('does not equal an identifier with a different primitive value', () => {
      const first = CourseId.from('course-123');
      const second = CourseId.from('course-124');

      expect(first.equals(second)).toBe(false);
    });
  });

  describe('immutability', () => {
    it('freezes the CourseId instance', () => {
      const id = CourseId.from('course-123');

      expect(Object.isFrozen(id)).toBe(true);
    });

    it('keeps the primitive value stable', () => {
      const id = CourseId.from('course-123');
      const originalValue = id.value;

      expect(id.value).toBe(originalValue);
      expect(id.toString()).toBe(originalValue);
    });
  });
});