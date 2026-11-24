import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from './theme-provider.js';
import { THEME_STORAGE_KEY } from './theme-storage.js';
import { useTheme } from './use-theme.js';

let mediaMatches = false;

let changeHandler: ((event: MediaQueryListEvent) => void) | undefined;

function ThemeConsumer() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <section>
      <p data-testid="preference">{theme}</p>
      <p data-testid="resolved-theme">{resolvedTheme}</p>

      <button onClick={() => setTheme('light')}>Use light</button>
      <button onClick={() => setTheme('dark')}>Use dark</button>
      <button onClick={() => setTheme('system')}>Use system</button>
    </section>
  );
}

function renderThemeProvider() {
  return render(
    <ThemeProvider>
      <ThemeConsumer />
    </ThemeProvider>,
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');

    mediaMatches = false;
    changeHandler = undefined;

    const mediaQuery = {
      get matches() {
        return mediaMatches;
      },
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: vi.fn(
        (_type: string, listener: EventListenerOrEventListenerObject) => {
          if (typeof listener === 'function') {
            changeHandler = listener as (event: MediaQueryListEvent) => void;
          }
        },
      ),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    } as unknown as MediaQueryList;

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => mediaQuery),
    });
  });

  it('uses light as the default preference', () => {
    renderThemeProvider();

    expect(screen.getByTestId('preference').textContent).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('restores a previously saved preference', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    renderThemeProvider();

    expect(screen.getByTestId('preference').textContent).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('changes the theme and persists the preference', () => {
    renderThemeProvider();

    fireEvent.click(screen.getByRole('button', { name: 'Use dark' }));

    expect(screen.getByTestId('preference').textContent).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('follows operating-system changes in system mode', () => {
    renderThemeProvider();

    fireEvent.click(screen.getByRole('button', { name: 'Use system' }));

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    mediaMatches = true;

    act(() => {
      changeHandler?.({ matches: true } as MediaQueryListEvent);
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('does not follow operating-system changes in explicit dark mode', () => {
    renderThemeProvider();

    fireEvent.click(screen.getByRole('button', { name: 'Use dark' }));

    mediaMatches = false;

    act(() => {
      changeHandler?.({ matches: false } as MediaQueryListEvent);
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('throws when useTheme is used outside its provider', () => {
    function InvalidConsumer() {
      useTheme();
      return null;
    }

    expect(() => render(<InvalidConsumer />)).toThrow(
      'useTheme must be used within a ThemeProvider.',
    );
  });
});
