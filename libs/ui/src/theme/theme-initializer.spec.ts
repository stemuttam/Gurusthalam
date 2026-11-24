import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyThemePreference,
  getSystemThemePreference,
  initializeTheme,
  resolveTheme,
} from './theme-initializer.js';

import { THEME_STORAGE_KEY } from './theme-storage.js';

describe('theme initializer', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('uses light when no preference is stored', () => {
    expect(initializeTheme()).toBe('light');

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('restores a saved dark preference', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    expect(initializeTheme()).toBe('dark');

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('resolves system preferences correctly', () => {
    expect(resolveTheme('system', 'dark')).toBe('dark');
    expect(resolveTheme('system', 'light')).toBe('light');
    expect(resolveTheme('dark', 'light')).toBe('dark');
    expect(resolveTheme('light', 'dark')).toBe('light');
  });

  it('applies a theme to a supplied root element', () => {
    const root = document.createElement('html');

    expect(applyThemePreference('dark', root)).toBe('dark');

    expect(root.getAttribute('data-theme')).toBe('dark');
  });

  it('detects a dark operating-system preference', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({ matches: true })),
    });

    expect(getSystemThemePreference()).toBe('dark');
  });
});
