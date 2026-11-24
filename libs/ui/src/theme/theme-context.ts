import { createContext } from 'react';

import type { ResolvedTheme } from './theme-initializer.js';
import type { ThemePreference } from './theme-storage.js';

export interface ThemeContextValue {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(
  undefined,
);
