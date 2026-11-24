import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@gurusthalam/ui';

import App from './app';

describe('Admin application UI library integration', () => {
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
  });

  it('renders the administration workspace heading', () => {
    renderApp();

    expect(
      screen.getByRole('heading', {
        name: 'Administration workspace',
      }),
    ).toBeTruthy();
  });

  it('renders the shared UI package integration preview', () => {
    renderApp();

    expect(screen.getByText('UI package connected')).toBeTruthy();
    expect(screen.getByText('Integration preview')).toBeTruthy();
  });

  it('renders the shared avatar and empty state components', () => {
    renderApp();

    expect(
      screen.getByRole('img', {
        name: 'Gurusthalam Administrator',
      }),
    ).toBeTruthy();

    expect(
      screen.getByText('No administration modules in this preview'),
    ).toBeTruthy();
  });

  it('displays and dismisses a shared UI toast notification', () => {
    renderApp();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Show notification',
      }),
    );

    expect(screen.getByText('Shared UI notification')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Dismiss notification',
      }),
    );

    expect(screen.queryByText('Shared UI notification')).toBeNull();
  });

  it('opens the shared Dialog and dismisses it with Escape', () => {
    renderApp();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Open dialog',
      }),
    );

    expect(
      screen.getByRole('dialog', {
        name: 'Admin dialog preview',
      }),
    ).toBeTruthy();

    fireEvent.keyDown(
      screen.getByRole('dialog', {
        name: 'Admin dialog preview',
      }),
      {
        key: 'Escape',
      },
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('switches between shared Tabs panels', () => {
    renderApp();

    expect(screen.getByText('Overview selected')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('tab', {
        name: 'Details',
      }),
    );

    expect(screen.getByText('Details selected')).toBeTruthy();

    expect(screen.queryByText('Overview selected')).toBeNull();
  });

  it('displays the shared Tooltip on hover', () => {
    renderApp();

    const trigger = screen.getByRole('button', {
      name: 'Hover or focus here',
    });

    fireEvent.mouseEnter(trigger);

    expect(screen.getByRole('tooltip')).toBeTruthy();

    expect(
      screen.getByText('This tooltip is provided by the shared UI package.'),
    ).toBeTruthy();

    fireEvent.mouseLeave(trigger);

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('opens the shared Dropdown Menu and selects an action', () => {
    renderApp();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Admin actions',
      }),
    );

    expect(screen.getByRole('menu')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('menuitem', {
        name: 'Manage courses',
      }),
    );

    expect(screen.getByText('Selected action: Manage courses')).toBeTruthy();

    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('does not allow selection of a disabled Dropdown Menu item', () => {
    renderApp();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Admin actions',
      }),
    );

    const disabledItem = screen.getByRole('menuitem', {
      name: 'Disabled action',
    });

    expect(disabledItem).toBeTruthy();

    fireEvent.click(disabledItem);

    expect(screen.getByText('No action selected yet.')).toBeTruthy();

    expect(screen.getByRole('menu')).toBeTruthy();
  });
});
