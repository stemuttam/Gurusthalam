/// <reference lib="dom" />
import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@gurusthalam/ui';

import App from './app';

describe('Web application UI library integration', () => {
  function renderApp() {
    return render(
      <ThemeProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>,
    );
  }

  it('renders the shared theme switcher', () => {
    renderApp();

    expect(
      screen.getByRole('group', { name: 'Theme preference' }),
    ).toBeTruthy();

    expect(screen.getByRole('button', { name: 'Light theme' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dark theme' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'System theme' })).toBeTruthy();
  });

  it('switches to dark theme from the application header', () => {
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Dark theme' }));

    expect(
      screen.getByRole('button', {
        name: 'Dark theme',
        pressed: true,
      }),
    ).toBeTruthy();

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('switches back to light theme from the application header', () => {
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Dark theme' }));
    fireEvent.click(screen.getByRole('button', { name: 'Light theme' }));

    expect(
      screen.getByRole('button', {
        name: 'Light theme',
        pressed: true,
      }),
    ).toBeTruthy();

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('selects the system preference from the application header', () => {
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'System theme' }));

    expect(
      screen.getByRole('button', {
        name: 'System theme',
        pressed: true,
      }),
    ).toBeTruthy();

    expect(localStorage.getItem('gurusthalam-theme')).toBe('system');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('renders the learner workspace heading', () => {
    renderApp();

    expect(
      screen.getByRole('heading', { name: 'Learner workspace' }),
    ).toBeTruthy();
  });

  it('renders the shared UI package integration confirmation', () => {
    renderApp();

    expect(screen.getByText('Shared UI package connected')).toBeTruthy();
  });

  it('renders shared UI components through the public package API', () => {
    renderApp();

    expect(screen.getByText('Connected')).toBeTruthy();
    expect(screen.getByText('Example progress')).toBeTruthy();

    expect(
      screen.getByRole('button', { name: 'Show notification' }),
    ).toBeTruthy();
  });

  it('displays and dismisses a shared UI toast notification', () => {
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Show notification' }));

    expect(screen.getByText('Shared UI notification')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss notification' }),
    );

    expect(screen.queryByText('Shared UI notification')).toBeNull();
  });
});
