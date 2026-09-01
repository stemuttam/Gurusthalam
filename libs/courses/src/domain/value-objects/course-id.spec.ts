import { describe, expect, it } from 'vitest';

import { CourseId } from './course-id.js';

describe('CourseId', () => {
  it('generates a non-empty identifier', () => {
    const id = CourseId.generate();

    expect(id).toBeInstanceOf(CourseId);
    expect(id.value).toBeTypeOf('string');
    expect(id.value.length).toBeGreaterThan(0);
  });

  it('rehydrates a valid identifier', () => {
    const id = CourseId.from('course-123');

    expect(id.value).toBe('course-123');
    expect(id.toString()).toBe('course-123');
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

  it('compares identifiers by value', () => {
    const first = CourseId.from('course-123');
    const second = CourseId.from('course-123');
    const third = CourseId.from('course-456');

    expect(first.equals(second)).toBe(true);
    expect(first.equals(third)).toBe(false);
  });

  it('exposes its value as immutable state', () => {
    const id = CourseId.from('course-123');

    expect(Object.isFrozen(id)).toBe(true);
  });
});