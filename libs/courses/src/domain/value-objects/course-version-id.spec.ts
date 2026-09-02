import { describe, expect, it } from 'vitest';

import { CourseVersionId } from './course-version-id.js';

describe('CourseVersionId', () => {
  it('generates a non-empty identifier', () => {
    const id = CourseVersionId.generate();

    expect(id).toBeInstanceOf(CourseVersionId);
    expect(id.value).toBeTypeOf('string');
    expect(id.value.length).toBeGreaterThan(0);
  });

  it('rehydrates a valid identifier', () => {
    const id = CourseVersionId.from('course-version-123');

    expect(id.value).toBe('course-version-123');
    expect(id.toString()).toBe('course-version-123');
  });

  it('rejects an empty identifier', () => {
    expect(() => CourseVersionId.from('')).toThrow(
      'CourseVersionId must be a non-empty string.',
    );
  });

  it('rejects a whitespace-only identifier', () => {
    expect(() => CourseVersionId.from('   ')).toThrow(
      'CourseVersionId must be a non-empty string.',
    );
  });

  it('compares identifiers by value', () => {
    const first = CourseVersionId.from('version-123');
    const second = CourseVersionId.from('version-123');
    const third = CourseVersionId.from('version-456');

    expect(first.equals(second)).toBe(true);
    expect(first.equals(third)).toBe(false);
  });

  it('freezes the identifier object', () => {
    const id = CourseVersionId.from('version-123');

    expect(Object.isFrozen(id)).toBe(true);
  });
});