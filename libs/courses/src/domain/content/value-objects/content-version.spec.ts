import { describe, expect, it } from 'vitest';

import { ContentVersion } from './content-version.js';

describe('ContentVersion', () => {
  it('starts at version 1', () => {
    const version = ContentVersion.initial();

    expect(version.value).toBe(1);
    expect(version.toNumber()).toBe(1);
  });

  it.each([
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])('rejects invalid version %j', (value) => {
    expect(ContentVersion.isValid(value)).toBe(false);
    expect(() => ContentVersion.from(value)).toThrow();
  });

  it('creates the next immutable version', () => {
    const version = ContentVersion.from(3);
    const next = version.next();

    expect(version.value).toBe(3);
    expect(next.value).toBe(4);
    expect(version.equals(next)).toBe(false);
    expect(Object.isFrozen(version)).toBe(true);
    expect(Object.isFrozen(next)).toBe(true);
  });
});
