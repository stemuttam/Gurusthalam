export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'gurusthalam-theme';

function getStorage(
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
): Pick<Storage, 'getItem' | 'setItem'> | undefined {
  if (storage) {
    return storage;
  }

  try {
    if (typeof window !== 'undefined') {
      return window.localStorage;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function readThemePreference(
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
): ThemePreference | null {
  try {
    const value = getStorage(storage)?.getItem(THEME_STORAGE_KEY);

    return isThemePreference(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeThemePreference(
  preference: ThemePreference,
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
): boolean {
  try {
    const target = getStorage(storage);

    if (!target) {
      return false;
    }

    target.setItem(THEME_STORAGE_KEY, preference);

    return true;
  } catch {
    return false;
  }
}
