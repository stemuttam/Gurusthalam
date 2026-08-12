import {
  chunk,
  unique,
} from './array.utils.js';

import {
  addDays,
} from './date.utils.js';

import {
  generateId,
} from './id.utils.js';

import {
  omit,
} from './object.utils.js';

import {
  capitalize,
  isBlank,
  toSlug,
} from './string.utils.js';

describe('Shared utilities', () => {
  it('capitalizes strings', () => {
    expect(capitalize('gurusthalam')).toBe(
      'Gurusthalam',
    );
  });

  it('creates slugs', () => {
    expect(
      toSlug('Learn JavaScript With Gurusthalam'),
    ).toBe('learn-javascript-with-gurusthalam');
  });

  it('detects blank strings', () => {
    expect(isBlank('   ')).toBe(true);
    expect(isBlank('Gurusthalam')).toBe(false);
  });

  it('removes duplicate values', () => {
    expect(unique([1, 1, 2, 2, 3])).toEqual([
      1,
      2,
      3,
    ]);
  });

  it('chunks arrays', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([
      [1, 2],
      [3, 4],
      [5],
    ]);
  });

  it('adds days to dates', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');

    expect(
      addDays(date, 1).toISOString(),
    ).toBe('2026-01-02T00:00:00.000Z');
  });

  it('omits object properties', () => {
    expect(
      omit(
        {
          id: '1',
          name: 'Gurusthalam',
          password: 'secret',
        },
        ['password'],
      ),
    ).toEqual({
      id: '1',
      name: 'Gurusthalam',
    });
  });

  it('generates UUIDs', () => {
    const id = generateId();

    expect(id).toMatch(
      /^[0-9a-f-]{36}$/i,
    );
  });
});