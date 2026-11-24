// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ThemeProvider } from './theme-provider.js';
import { THEME_STORAGE_KEY } from './theme-storage.js';
import { ThemeSwitcher } from './ThemeSwitcher.js';

afterEach(() => {
  cleanup();
});

describe('ThemeSwitcher', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  function renderSwitcher() {
    return render(
      <ThemeProvider>
        <ThemeSwitcher />
      </ThemeProvider>,
    );
  }

  it('renders all three theme preferences', () => {
    renderSwitcher();

    expect(
      screen.getByRole('group', { name: 'Theme preference' }),
    ).toBeTruthy();

    expect(screen.getByRole('button', { name: 'Light theme' })).toBeTruthy();

    expect(screen.getByRole('button', { name: 'Dark theme' })).toBeTruthy();

    expect(screen.getByRole('button', { name: 'System theme' })).toBeTruthy();
  });

  it('marks light as selected by default', () => {
    renderSwitcher();

    expect(
      screen.getByRole('button', {
        name: 'Light theme',
        pressed: true,
      }),
    ).toBeTruthy();
  });

  it('changes and persists the dark preference', () => {
    renderSwitcher();

    fireEvent.click(screen.getByRole('button', { name: 'Dark theme' }));

    expect(
      screen.getByRole('button', {
        name: 'Dark theme',
        pressed: true,
      }),
    ).toBeTruthy();

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('changes and persists the light preference', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    renderSwitcher();

    fireEvent.click(screen.getByRole('button', { name: 'Light theme' }));

    expect(
      screen.getByRole('button', {
        name: 'Light theme',
        pressed: true,
      }),
    ).toBeTruthy();

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('allows selecting the system preference', () => {
    renderSwitcher();

    fireEvent.click(screen.getByRole('button', { name: 'System theme' }));

    expect(
      screen.getByRole('button', {
        name: 'System theme',
        pressed: true,
      }),
    ).toBeTruthy();

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
  });

  it('uses native focusable buttons for keyboard accessibility', () => {
    renderSwitcher();

    const darkButton = screen.getByRole('button', {
      name: 'Dark theme',
    });

    expect(darkButton.getAttribute('type')).toBe('button');
    expect(darkButton.tabIndex).toBe(0);

    darkButton.focus();

    expect(document.activeElement).toBe(darkButton);
    expect(darkButton.getAttribute('aria-pressed')).toBe('false');
  });
});
