import { describe, expect, it } from 'vitest';

import { ContentMetadata } from './content-metadata.js';

describe('ContentMetadata', () => {
  it('supports primitive metadata and detaches input state', () => {
    const input = {
      values: {
        durationSeconds: 120,
        featured: true,
        note: 'intro',
        missing: null,
      },
    };

    const metadata = ContentMetadata.from(input);

    expect(metadata.get('durationSeconds')).toBe(120);
    expect(metadata.get('featured')).toBe(true);
    expect(metadata.has('note')).toBe(true);
    expect(metadata.get('missing')).toBeNull();
    expect(Object.isFrozen(metadata)).toBe(true);
    expect(Object.isFrozen(metadata.values)).toBe(true);
  });

  it('provides deterministic equality', () => {
    const first = ContentMetadata.from({
      values: {
        a: 1,
        b: 'two',
      },
    });

    const second = ContentMetadata.from({
      values: {
        a: 1,
        b: 'two',
      },
    });

    const third = ContentMetadata.from({
      values: {
        a: 1,
        b: 'three',
      },
    });

    expect(first.equals(second)).toBe(true);
    expect(first.equals(third)).toBe(false);
  });

  it.each([
    { values: { ' bad': 'x' } },
    { values: { bad: Number.NaN } },
    { values: { bad: Number.POSITIVE_INFINITY } },
  ])('rejects invalid metadata %j', (value) => {
    expect(() => ContentMetadata.from(value)).toThrow();
    expect(ContentMetadata.isValid(value)).toBe(false);
  });
});
