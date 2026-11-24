// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from './theme-provider.js';
import { THEME_STORAGE_KEY } from './theme-storage.js';
import { useTheme } from './use-theme.js';

let mediaMatches = false;

let changeHandler: ((event: MediaQueryListEvent) => void) | undefined;

const addEventListener = vi.fn(
  (_type: string, listener: EventListenerOrEventListenerObject) => {
    if (typeof listener === 'function') {
      changeHandler = listener as (event: MediaQueryListEvent) => void;
    }
  },
);

const removeEventListener = vi.fn();

function ThemeConsumer() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <section>
      <p data-testid="preference">{theme}</p>
      <p data-testid="resolved-theme">{resolvedTheme}</p>

      <button type="button" onClick={() => setTheme('light')}>
        Use light
      </button>

      <button type="button" onClick={() => setTheme('dark')}>
        Use dark
      </button>

      <button type="button" onClick={() => setTheme('system')}>
        Use system
      </button>
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

afterEach(() => {
  cleanup();
});

describe('ThemeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');

    mediaMatches = false;
    changeHandler = undefined;

    addEventListener.mockClear();
    removeEventListener.mockClear();

    const mediaQuery = {
      get matches() {
        return mediaMatches;
      },
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener,
      removeEventListener,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    } as unknown as MediaQueryList;

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn(() => mediaQuery),
    });
  });

  it('uses light as the default preference', () => {
    renderThemeProvider();

    expect(screen.getByTestId('preference').textContent).toBe('light');
    expect(screen.getByTestId('resolved-theme').textContent).toBe('light');

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('restores a previously saved preference', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    renderThemeProvider();

    expect(screen.getByTestId('preference').textContent).toBe('dark');
    expect(screen.getByTestId('resolved-theme').textContent).toBe('dark');

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('changes the theme and persists the preference', () => {
    renderThemeProvider();

    fireEvent.click(screen.getByRole('button', { name: 'Use dark' }));

    expect(screen.getByTestId('preference').textContent).toBe('dark');
    expect(screen.getByTestId('resolved-theme').textContent).toBe('dark');

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('updates the document and React context when the system changes to dark', () => {
    renderThemeProvider();

    fireEvent.click(screen.getByRole('button', { name: 'Use system' }));

    expect(screen.getByTestId('preference').textContent).toBe('system');
    expect(screen.getByTestId('resolved-theme').textContent).toBe('light');

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    expect(addEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    );

    mediaMatches = true;

    act(() => {
      changeHandler?.({ matches: true } as MediaQueryListEvent);
    });

    expect(screen.getByTestId('preference').textContent).toBe('system');
    expect(screen.getByTestId('resolved-theme').textContent).toBe('dark');

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('updates the document and React context when the system changes to light', () => {
    mediaMatches = true;

    renderThemeProvider();

    fireEvent.click(screen.getByRole('button', { name: 'Use system' }));

    expect(screen.getByTestId('resolved-theme').textContent).toBe('dark');

    mediaMatches = false;

    act(() => {
      changeHandler?.({ matches: false } as MediaQueryListEvent);
    });

    expect(screen.getByTestId('resolved-theme').textContent).toBe('light');

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('removes the system preference listener when leaving system mode', () => {
    renderThemeProvider();

    fireEvent.click(screen.getByRole('button', { name: 'Use system' }));

    expect(addEventListener).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Use dark' }));

    expect(removeEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    );

    expect(screen.getByTestId('resolved-theme').textContent).toBe('dark');

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('does not follow operating-system changes in explicit dark mode', () => {
    renderThemeProvider();

    fireEvent.click(screen.getByRole('button', { name: 'Use dark' }));

    expect(screen.getByTestId('resolved-theme').textContent).toBe('dark');

    expect(addEventListener).not.toHaveBeenCalled();

    mediaMatches = true;

    expect(screen.getByTestId('resolved-theme').textContent).toBe('dark');

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
