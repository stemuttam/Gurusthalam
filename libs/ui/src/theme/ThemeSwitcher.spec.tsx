
import { fireEvent, render, screen } from '@testing-library/react';

import { ThemeProvider } from './theme-provider.js';
import { THEME_STORAGE_KEY } from './theme-storage.js';
import { ThemeSwitcher } from './ThemeSwitcher.js';

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

    expect(screen.getByRole('group', { name: 'Theme preference' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Light theme' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dark theme' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'System theme' })).toBeTruthy();
  });

  it('marks light as selected by default', () => {
    renderSwitcher();

    expect(
      screen.getByRole('button', { name: 'Light theme' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('changes and persists the dark preference', () => {
    renderSwitcher();

    fireEvent.click(screen.getByRole('button', { name: 'Dark theme' }));

    expect(
      screen.getByRole('button', { name: 'Dark theme' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('changes and persists the light preference', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    renderSwitcher();

    fireEvent.click(screen.getByRole('button', { name: 'Light theme' }));

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('allows selecting the system preference', () => {
    renderSwitcher();

    fireEvent.click(screen.getByRole('button', { name: 'System theme' }));

    expect(
      screen.getByRole('button', { name: 'System theme' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
  });

  it('supports keyboard activation through native buttons', () => {
    renderSwitcher();

    const darkButton = screen.getByRole('button', { name: 'Dark theme' });

    darkButton.focus();
    expect(document.activeElement).toBe(darkButton);

    fireEvent.keyDown(darkButton, { key: 'Enter' });
    fireEvent.click(darkButton);

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
