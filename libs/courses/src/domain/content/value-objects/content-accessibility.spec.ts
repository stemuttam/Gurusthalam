import { describe, expect, it } from 'vitest';

import { ContentAccessibility } from './content-accessibility.js';

describe('ContentAccessibility', () => {
  it('stores a unique immutable feature list', () => {
    const accessibility = ContentAccessibility.from({
      features: ['captions', 'transcript', 'keyboard-navigation'],
    });

    expect(accessibility.features).toEqual([
      'captions',
      'transcript',
      'keyboard-navigation',
    ]);

    expect(accessibility.supports('captions')).toBe(true);
    expect(accessibility.supports('audio-description')).toBe(false);

    expect(Object.isFrozen(accessibility)).toBe(true);
    expect(Object.isFrozen(accessibility.features)).toBe(true);
  });

  it('rejects duplicate or non-canonical features', () => {
    expect(() =>
      ContentAccessibility.from({
        features: ['captions', 'captions'],
      }),
    ).toThrow();

    expect(() =>
      ContentAccessibility.from({
        features: [' captions'],
      }),
    ).toThrow();

    expect(
      ContentAccessibility.isValid({
        features: ['captions', 'captions'],
      }),
    ).toBe(false);
  });
});
