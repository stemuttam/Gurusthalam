import { describe, expect, it, vi } from 'vitest';

import {
  readThemePreference,
  THEME_STORAGE_KEY,
  writeThemePreference,
} from './theme-storage.js';

describe('theme storage', () => {
  it('returns null when no preference is stored', () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    };

    expect(readThemePreference(storage)).toBeNull();
  });

  it.each(['light', 'dark', 'system'] as const)(
    'reads the %s preference',
    (preference) => {
      const storage = {
        getItem: vi.fn(() => preference),
        setItem: vi.fn(),
      };

      expect(readThemePreference(storage)).toBe(preference);
      expect(storage.getItem).toHaveBeenCalledWith(THEME_STORAGE_KEY);
    },
  );

  it('rejects invalid stored preferences', () => {
    const storage = {
      getItem: vi.fn(() => 'invalid'),
      setItem: vi.fn(),
    };

    expect(readThemePreference(storage)).toBeNull();
  });

  it('persists a preference', () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    };

    expect(writeThemePreference('dark', storage)).toBe(true);

    expect(storage.setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'dark');
  });

  it('handles storage read failures', () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error('Storage unavailable');
      }),
      setItem: vi.fn(),
    };

    expect(readThemePreference(storage)).toBeNull();
  });

  it('handles storage write failures', () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new Error('Storage unavailable');
      }),
    };

    expect(writeThemePreference('dark', storage)).toBe(false);
  });
});
