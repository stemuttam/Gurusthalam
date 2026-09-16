import { describe, expect, it } from 'vitest';

import { CourseActorId } from './course-actor-id.js';

describe('CourseActorId', () => {
  it('rehydrates valid opaque actor identifiers', () => {
    const actorId = CourseActorId.from('user-001');

    expect(actorId.toString()).toBe('user-001');
    expect(actorId.value).toBe('user-001');
  });

  it('does not require UUID syntax', () => {
    expect(CourseActorId.from('instructor-2026-001').toString()).toBe(
      'instructor-2026-001',
    );
  });

  it.each(['', ' ', '  user-001', 'user-001  ', '\tuser-001', 'user-001\n'])(
    'rejects invalid identifier %j',
    (value) => {
      expect(() => CourseActorId.from(value)).toThrow(TypeError);
    },
  );

  it('validates primitive identifiers', () => {
    expect(CourseActorId.isValid('user-001')).toBe(true);

    expect(CourseActorId.isValid('')).toBe(false);
    expect(CourseActorId.isValid('   ')).toBe(false);
    expect(CourseActorId.isValid(' user-001')).toBe(false);
    expect(CourseActorId.isValid('user-001 ')).toBe(false);
    expect(CourseActorId.isValid(null)).toBe(false);
    expect(CourseActorId.isValid(undefined)).toBe(false);
    expect(CourseActorId.isValid(123)).toBe(false);
  });

  it('compares identifiers by value', () => {
    const first = CourseActorId.from('user-001');
    const second = CourseActorId.from('user-001');
    const other = CourseActorId.from('user-002');

    expect(first).not.toBe(second);
    expect(first.equals(second)).toBe(true);
    expect(first.equals(other)).toBe(false);
  });

  it('freezes identifier instances', () => {
    const actorId = CourseActorId.from('user-001');

    expect(Object.isFrozen(actorId)).toBe(true);
  });
});
