import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { ThemeContext } from './theme-context.js';
import {
  applyThemePreference,
  getSystemThemePreference,
  resolveTheme,
} from './theme-initializer.js';
import {
  readThemePreference,
  writeThemePreference,
  type ThemePreference,
} from './theme-storage.js';

export interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemePreference>(
    () => readThemePreference() ?? 'light',
  );

  const [resolvedTheme, setResolvedTheme] = useState(() =>
    resolveTheme(theme, getSystemThemePreference()),
  );

  const setTheme = useCallback((nextTheme: ThemePreference) => {
    setThemeState(nextTheme);
    writeThemePreference(nextTheme);

    const nextResolvedTheme = applyThemePreference(nextTheme);

    setResolvedTheme(nextResolvedTheme);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    let mediaQuery: MediaQueryList | undefined;

    if (
      theme === 'system' &&
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function'
    ) {
      try {
        mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      } catch {
        mediaQuery = undefined;
      }
    }

    const updateTheme = () => {
      const systemTheme = mediaQuery
        ? mediaQuery.matches
          ? 'dark'
          : 'light'
        : undefined;

      const nextResolvedTheme = applyThemePreference(
        theme,
        document.documentElement,
        systemTheme,
      );

      setResolvedTheme(nextResolvedTheme);
    };

    updateTheme();

    if (theme !== 'system' || !mediaQuery) {
      return undefined;
    }

    mediaQuery.addEventListener('change', updateTheme);

    return () => {
      mediaQuery.removeEventListener('change', updateTheme);
    };
  }, [theme]);

  const contextValue = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [theme, resolvedTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}
