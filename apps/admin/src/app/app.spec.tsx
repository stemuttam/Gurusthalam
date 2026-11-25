/// <reference lib="dom" />

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@gurusthalam/ui';

import App from './app';

afterEach(() => {
  cleanup();
});

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

  expect(screen.getByText('GA')).toBeTruthy();

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

  describe('shared Dialog integration', () => {
    it('opens the shared Dialog and renders accessible content', () => {
      renderApp();

      fireEvent.click(
        screen.getByRole('button', {
          name: 'Open dialog',
        }),
      );

      const dialog = screen.getByRole('dialog', {
        name: 'Admin dialog preview',
      });

      expect(dialog.getAttribute('aria-modal')).toBe('true');

      expect(
        screen.getByText(
          'This dialog is rendered by the shared Gurusthalam UI package.',
        ),
      ).toBeTruthy();
    });

    it('dismisses the Dialog with Escape', () => {
      renderApp();

      fireEvent.click(
        screen.getByRole('button', {
          name: 'Open dialog',
        }),
      );

      expect(screen.getByRole('dialog')).toBeTruthy();

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('closes the Dialog using its close control', () => {
      renderApp();

      fireEvent.click(screen.getByRole('button', { name: 'Open dialog' }));

      const dialog = screen.getByRole('dialog', {
        name: 'Admin dialog preview',
      });

      expect(dialog).toBeTruthy();

      const headerCloseButton = dialog.querySelector<HTMLButtonElement>(
        'header button[aria-label="Close dialog"]',
      );

      expect(headerCloseButton).not.toBeNull();

      if (!headerCloseButton) {
        throw new Error('Dialog header close button was not rendered.');
      }

      fireEvent.click(headerCloseButton);

      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('closes the Dialog when its overlay is clicked', () => {
      renderApp();

      fireEvent.click(
        screen.getByRole('button', {
          name: 'Open dialog',
        }),
      );

      expect(screen.getByRole('dialog')).toBeTruthy();

      fireEvent.mouseDown(screen.getByTestId('gt-dialog-overlay'));

      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  describe('shared Tabs integration', () => {
    it('renders the default Overview panel', () => {
      renderApp();

      expect(screen.getByText('Overview selected')).toBeTruthy();

      expect(
        screen
          .getByRole('tab', { name: 'Overview' })
          .getAttribute('aria-selected'),
      ).toBe('true');
    });

    it('switches between shared Tabs panels', () => {
      renderApp();

      fireEvent.click(
        screen.getByRole('tab', {
          name: 'Details',
        }),
      );

      expect(screen.getByText('Details selected')).toBeTruthy();

      expect(screen.queryByText('Overview selected')).toBeNull();

      expect(
        screen
          .getByRole('tab', { name: 'Details' })
          .getAttribute('aria-selected'),
      ).toBe('true');
    });

    it('supports keyboard arrow navigation between tabs', () => {
      renderApp();

      const overview = screen.getByRole('tab', { name: 'Overview' });
      const details = screen.getByRole('tab', { name: 'Details' });

      overview.focus();

      fireEvent.keyDown(overview, { key: 'ArrowRight' });

      expect(document.activeElement).toBe(details);

      expect(details.getAttribute('aria-selected')).toBe('true');
      expect(screen.getByText('Details selected')).toBeTruthy();
    });

    it('supports Home and End keyboard navigation', () => {
      renderApp();

      const overview = screen.getByRole('tab', { name: 'Overview' });
      const details = screen.getByRole('tab', { name: 'Details' });

      overview.focus();

      fireEvent.keyDown(overview, { key: 'End' });

      expect(document.activeElement).toBe(details);

      fireEvent.keyDown(details, { key: 'Home' });

      expect(document.activeElement).toBe(overview);
    });
  });

  describe('shared Tooltip integration', () => {
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
    });

    it('hides the Tooltip when the pointer leaves its trigger', () => {
      renderApp();

      const trigger = screen.getByRole('button', {
        name: 'Hover or focus here',
      });

      fireEvent.mouseEnter(trigger);

      expect(screen.getByRole('tooltip')).toBeTruthy();

      fireEvent.mouseLeave(trigger);

      expect(screen.queryByRole('tooltip')).toBeNull();
    });

    it('displays the Tooltip when the trigger receives keyboard focus', () => {
      renderApp();

      const trigger = screen.getByRole('button', {
        name: 'Hover or focus here',
      });

      fireEvent.focus(trigger);

      const tooltip = screen.getByRole('tooltip');

      expect(tooltip).toBeTruthy();

      expect(trigger.getAttribute('aria-describedby')).toContain(tooltip.id);
    });

    it('dismisses the focused Tooltip with Escape', () => {
      renderApp();

      const trigger = screen.getByRole('button', {
        name: 'Hover or focus here',
      });

      fireEvent.focus(trigger);

      expect(screen.getByRole('tooltip')).toBeTruthy();

      fireEvent.keyDown(trigger, { key: 'Escape' });

      expect(screen.queryByRole('tooltip')).toBeNull();
    });
  });

  describe('shared Dropdown Menu integration', () => {
    it('opens the shared Dropdown Menu', () => {
      renderApp();

      const trigger = screen.getByRole('button', {
        name: 'Admin actions',
      });

      fireEvent.click(trigger);

      expect(screen.getByRole('menu')).toBeTruthy();
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });

    it('opens the Dropdown Menu with ArrowDown from its trigger', () => {
      renderApp();

      const trigger = screen.getByRole('button', {
        name: 'Admin actions',
      });

      fireEvent.keyDown(trigger, { key: 'ArrowDown' });

      expect(screen.getByRole('menu')).toBeTruthy();
    });

    it('opens the Dropdown Menu with ArrowUp from its trigger', () => {
      renderApp();

      const trigger = screen.getByRole('button', {
        name: 'Admin actions',
      });

      fireEvent.keyDown(trigger, { key: 'ArrowUp' });

      expect(screen.getByRole('menu')).toBeTruthy();
    });

    it('selects an action and closes the Dropdown Menu', () => {
      renderApp();

      fireEvent.click(
        screen.getByRole('button', {
          name: 'Admin actions',
        }),
      );

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

      fireEvent.click(disabledItem);

      expect(screen.getByText('No action selected yet.')).toBeTruthy();

      expect(screen.getByRole('menu')).toBeTruthy();
    });

    it('supports keyboard navigation between menu items', () => {
      renderApp();

      fireEvent.click(
        screen.getByRole('button', {
          name: 'Admin actions',
        }),
      );

      const menu = screen.getByRole('menu');
      const firstItem = screen.getByRole('menuitem', {
        name: 'View users',
      });
      const secondItem = screen.getByRole('menuitem', {
        name: 'Manage courses',
      });

      firstItem.focus();

      fireEvent.keyDown(menu, { key: 'ArrowDown' });

      expect(document.activeElement).toBe(secondItem);

      fireEvent.keyDown(menu, { key: 'Home' });

      expect(document.activeElement).toBe(firstItem);

      fireEvent.keyDown(menu, { key: 'End' });

      expect(document.activeElement).toBe(secondItem);
    });

    it('closes the menu with Escape and restores focus to its trigger', () => {
      renderApp();

      const trigger = screen.getByRole('button', {
        name: 'Admin actions',
      });

      fireEvent.click(trigger);

      const menu = screen.getByRole('menu');

      fireEvent.keyDown(menu, { key: 'Escape' });

      expect(screen.queryByRole('menu')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });

    it('closes the menu when clicking outside', () => {
      renderApp();

      fireEvent.click(
        screen.getByRole('button', {
          name: 'Admin actions',
        }),
      );

      expect(screen.getByRole('menu')).toBeTruthy();

      fireEvent.pointerDown(
        screen.getByRole('heading', {
          name: 'Administration workspace',
        }),
      );

      expect(screen.queryByRole('menu')).toBeNull();
    });
  });
});
