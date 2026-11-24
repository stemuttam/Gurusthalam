import { readThemePreference, type ThemePreference } from './theme-storage.js';

export type ResolvedTheme = 'light' | 'dark';

export function getSystemThemePreference(): ResolvedTheme {
  try {
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function'
    ) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
  } catch {
    // Use the documented light-theme fallback.
  }

  return 'light';
}

export function resolveTheme(
  preference: ThemePreference,
  systemTheme: ResolvedTheme = getSystemThemePreference(),
): ResolvedTheme {
  return preference === 'system' ? systemTheme : preference;
}

export function applyThemePreference(
  preference: ThemePreference,
  root?: HTMLElement,
  systemTheme?: ResolvedTheme,
): ResolvedTheme {
  const target =
    root ??
    (typeof document !== 'undefined' ? document.documentElement : undefined);

  const resolvedTheme = resolveTheme(
    preference,
    systemTheme ?? getSystemThemePreference(),
  );

  target?.setAttribute('data-theme', resolvedTheme);

  return resolvedTheme;
}

export function initializeTheme(): ThemePreference {
  const preference = readThemePreference() ?? 'light';

  applyThemePreference(preference);

  return preference;
}
