import { describe, expect, it } from 'vitest';

import { QuestionVersionNumber } from './question-version-number.js';

describe('QuestionVersionNumber', () => {
  describe('initial version', () => {
    it('creates the initial version number as 1', () => {
      const version = QuestionVersionNumber.initial();

      expect(version.value).toBe(1);
      expect(version.toNumber()).toBe(1);
      expect(version.toString()).toBe('1');
    });

    it('creates a QuestionVersionNumber instance', () => {
      expect(QuestionVersionNumber.initial()).toBeInstanceOf(
        QuestionVersionNumber,
      );
    });

    it('returns a new immutable instance for each initial value', () => {
      const first = QuestionVersionNumber.initial();
      const second = QuestionVersionNumber.initial();

      expect(first).not.toBe(second);
      expect(first.equals(second)).toBe(true);
    });
  });

  describe('rehydration', () => {
    it('rehydrates version number 1', () => {
      const version = QuestionVersionNumber.from(1);

      expect(version.value).toBe(1);
    });

    it('rehydrates a positive integer greater than 1', () => {
      const version = QuestionVersionNumber.from(42);

      expect(version.value).toBe(42);
    });

    it('rehydrates Number.MAX_SAFE_INTEGER', () => {
      const version = QuestionVersionNumber.from(Number.MAX_SAFE_INTEGER);

      expect(version.value).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('preserves the exact numeric value', () => {
      const value = 2026;
      const version = QuestionVersionNumber.from(value);

      expect(version.value).toBe(value);
      expect(version.toNumber()).toBe(value);
      expect(version.toString()).toBe('2026');
    });

    it('rejects zero', () => {
      expect(() => QuestionVersionNumber.from(0)).toThrow(
        'QuestionVersionNumber must be a positive safe integer.',
      );
    });

    it('rejects negative integers', () => {
      expect(() => QuestionVersionNumber.from(-1)).toThrow(
        'QuestionVersionNumber must be a positive safe integer.',
      );
    });

    it('rejects negative fractional numbers', () => {
      expect(() => QuestionVersionNumber.from(-1.5)).toThrow(
        'QuestionVersionNumber must be a positive safe integer.',
      );
    });

    it('rejects fractional numbers', () => {
      expect(() => QuestionVersionNumber.from(1.5)).toThrow(
        'QuestionVersionNumber must be a positive safe integer.',
      );
    });

    it('rejects values greater than Number.MAX_SAFE_INTEGER', () => {
      expect(() =>
        QuestionVersionNumber.from(Number.MAX_SAFE_INTEGER + 1),
      ).toThrow('QuestionVersionNumber must be a positive safe integer.');
    });

    it('rejects positive infinity', () => {
      expect(() => QuestionVersionNumber.from(Infinity)).toThrow(
        'QuestionVersionNumber must be a positive safe integer.',
      );
    });

    it('rejects negative infinity', () => {
      expect(() => QuestionVersionNumber.from(-Infinity)).toThrow(
        'QuestionVersionNumber must be a positive safe integer.',
      );
    });

    it('rejects NaN', () => {
      expect(() => QuestionVersionNumber.from(Number.NaN)).toThrow(
        'QuestionVersionNumber must be a positive safe integer.',
      );
    });

    it('rejects numeric strings without coercion', () => {
      expect(() =>
        QuestionVersionNumber.from('2' as unknown as number),
      ).toThrow('QuestionVersionNumber must be a positive safe integer.');
    });
  });

  describe('primitive validation', () => {
    it('accepts the initial version number', () => {
      expect(QuestionVersionNumber.isValid(1)).toBe(true);
    });

    it('accepts positive safe integers', () => {
      expect(QuestionVersionNumber.isValid(2)).toBe(true);
      expect(QuestionVersionNumber.isValid(42)).toBe(true);
      expect(QuestionVersionNumber.isValid(Number.MAX_SAFE_INTEGER)).toBe(true);
    });

    it('rejects zero', () => {
      expect(QuestionVersionNumber.isValid(0)).toBe(false);
    });

    it('rejects negative numbers', () => {
      expect(QuestionVersionNumber.isValid(-1)).toBe(false);
    });

    it('rejects fractional numbers', () => {
      expect(QuestionVersionNumber.isValid(1.5)).toBe(false);
    });

    it('rejects unsafe integers', () => {
      expect(QuestionVersionNumber.isValid(Number.MAX_SAFE_INTEGER + 1)).toBe(
        false,
      );
    });

    it('rejects NaN and infinities', () => {
      expect(QuestionVersionNumber.isValid(Number.NaN)).toBe(false);
      expect(QuestionVersionNumber.isValid(Infinity)).toBe(false);
      expect(QuestionVersionNumber.isValid(-Infinity)).toBe(false);
    });

    it('rejects non-number values', () => {
      expect(QuestionVersionNumber.isValid(null)).toBe(false);
      expect(QuestionVersionNumber.isValid(undefined)).toBe(false);
      expect(QuestionVersionNumber.isValid('1')).toBe(false);
      expect(QuestionVersionNumber.isValid({})).toBe(false);
      expect(QuestionVersionNumber.isValid([])).toBe(false);
      expect(QuestionVersionNumber.isValid(true)).toBe(false);
    });
  });

  describe('sequential progression', () => {
    it('advances the initial version from 1 to 2', () => {
      const first = QuestionVersionNumber.initial();
      const second = first.next();

      expect(first.value).toBe(1);
      expect(second.value).toBe(2);
    });

    it('advances arbitrary valid version numbers by exactly one', () => {
      const current = QuestionVersionNumber.from(41);
      const next = current.next();

      expect(next.value).toBe(42);
    });

    it('returns a new instance when advancing', () => {
      const current = QuestionVersionNumber.from(5);
      const next = current.next();

      expect(next).not.toBe(current);
      expect(next).toBeInstanceOf(QuestionVersionNumber);
    });

    it('does not mutate the current version number', () => {
      const current = QuestionVersionNumber.from(5);

      current.next();

      expect(current.value).toBe(5);
    });

    it('supports repeated sequential advancement', () => {
      const first = QuestionVersionNumber.initial();
      const second = first.next();
      const third = second.next();
      const fourth = third.next();

      expect(first.value).toBe(1);
      expect(second.value).toBe(2);
      expect(third.value).toBe(3);
      expect(fourth.value).toBe(4);
    });

    it('rejects advancement beyond Number.MAX_SAFE_INTEGER', () => {
      const maximum = QuestionVersionNumber.from(Number.MAX_SAFE_INTEGER);

      expect(() => maximum.next()).toThrow(
        'QuestionVersionNumber cannot exceed Number.MAX_SAFE_INTEGER.',
      );
    });

    it('does not mutate the maximum version when advancement fails', () => {
      const maximum = QuestionVersionNumber.from(Number.MAX_SAFE_INTEGER);

      expect(() => maximum.next()).toThrow(RangeError);
      expect(maximum.value).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('value equality', () => {
    it('compares version numbers by numeric value', () => {
      const first = QuestionVersionNumber.from(3);
      const second = QuestionVersionNumber.from(3);
      const third = QuestionVersionNumber.from(4);

      expect(first.equals(second)).toBe(true);
      expect(first.equals(third)).toBe(false);
    });

    it('does not rely on object reference equality', () => {
      const first = QuestionVersionNumber.from(3);
      const second = QuestionVersionNumber.from(3);

      expect(first).not.toBe(second);
      expect(first.equals(second)).toBe(true);
    });

    it('is reflexive', () => {
      const version = QuestionVersionNumber.from(3);

      expect(version.equals(version)).toBe(true);
    });

    it('is symmetric for equal values', () => {
      const first = QuestionVersionNumber.from(3);
      const second = QuestionVersionNumber.from(3);

      expect(first.equals(second)).toBe(true);
      expect(second.equals(first)).toBe(true);
    });

    it('does not equal a version number with a different value', () => {
      const first = QuestionVersionNumber.from(3);
      const second = QuestionVersionNumber.from(4);

      expect(first.equals(second)).toBe(false);
    });
  });

  describe('immutability', () => {
    it('freezes the QuestionVersionNumber instance', () => {
      const version = QuestionVersionNumber.from(3);

      expect(Object.isFrozen(version)).toBe(true);
    });

    it('keeps the primitive numeric value stable', () => {
      const version = QuestionVersionNumber.from(3);

      expect(version.value).toBe(3);
      expect(version.toNumber()).toBe(3);
      expect(version.toString()).toBe('3');
    });

    it('freezes the class constructor and protects static version bounds', () => {
      expect(Object.isFrozen(QuestionVersionNumber)).toBe(true);
      expect(QuestionVersionNumber.INITIAL_VALUE).toBe(1);
      expect(QuestionVersionNumber.MAX_VALUE).toBe(Number.MAX_SAFE_INTEGER);
    });
  });
});
