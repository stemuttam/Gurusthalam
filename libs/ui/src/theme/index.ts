export {
  applyThemePreference,
  getSystemThemePreference,
  initializeTheme,
  resolveTheme,
} from './theme-initializer.js';

export type { ResolvedTheme } from './theme-initializer.js';

export { ThemeProvider } from './theme-provider.js';

export type { ThemeProviderProps } from './theme-provider.js';

export {
  readThemePreference,
  THEME_STORAGE_KEY,
  writeThemePreference,
} from './theme-storage.js';

export type { ThemePreference } from './theme-storage.js';

export { useTheme } from './use-theme.js';
