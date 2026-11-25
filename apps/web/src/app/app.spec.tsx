/// <reference lib="dom" />

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@gurusthalam/ui';

import App from './app';

afterEach(() => {
  cleanup();
});

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

  describe('shared Dialog integration', () => {
    it('opens the Dialog and renders its accessible content', () => {
      renderApp();

      fireEvent.click(screen.getByRole('button', { name: 'Open dialog' }));

      const dialog = screen.getByRole('dialog', {
        name: 'Dialog interaction test',
      });

      expect(dialog.getAttribute('aria-modal')).toBe('true');

      expect(
        screen.getByText(
          'This dialog is rendered by the shared Gurusthalam UI library.',
        ),
      ).toBeTruthy();
    });

    it('closes the Dialog using its close control', () => {
      renderApp();

      fireEvent.click(screen.getByRole('button', { name: 'Open dialog' }));

      const dialog = screen.getByRole('dialog');

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

    it('closes the Dialog when Escape is pressed', () => {
      renderApp();

      fireEvent.click(screen.getByRole('button', { name: 'Open dialog' }));

      expect(screen.getByRole('dialog')).toBeTruthy();

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('closes the Dialog when its overlay is clicked', () => {
      renderApp();

      fireEvent.click(screen.getByRole('button', { name: 'Open dialog' }));

      expect(screen.getByRole('dialog')).toBeTruthy();

      fireEvent.mouseDown(screen.getByTestId('gt-dialog-overlay'));

      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  describe('shared Tabs integration', () => {
    it('renders the default Overview tab and panel', () => {
      renderApp();

      expect(
        screen
          .getByRole('tab', { name: 'Overview' })
          .getAttribute('aria-selected'),
      ).toBe('true');

      expect(screen.getByText('Overview selected')).toBeTruthy();
    });

    it('switches tab panels when a tab is activated', () => {
      renderApp();

      fireEvent.click(screen.getByRole('tab', { name: 'Lessons' }));

      expect(
        screen
          .getByRole('tab', { name: 'Lessons' })
          .getAttribute('aria-selected'),
      ).toBe('true');

      expect(screen.getByText('Lessons selected')).toBeTruthy();
      expect(screen.queryByText('Overview selected')).toBeNull();
    });

    it('supports keyboard arrow navigation between tabs', () => {
      renderApp();

      const overview = screen.getByRole('tab', { name: 'Overview' });
      const lessons = screen.getByRole('tab', { name: 'Lessons' });

      overview.focus();

      fireEvent.keyDown(overview, { key: 'ArrowRight' });

      expect(document.activeElement).toBe(lessons);

      expect(lessons.getAttribute('aria-selected')).toBe('true');
      expect(screen.getByText('Lessons selected')).toBeTruthy();
    });

    it('supports Home and End keyboard navigation', () => {
      renderApp();

      const overview = screen.getByRole('tab', { name: 'Overview' });
      const resources = screen.getByRole('tab', { name: 'Resources' });

      overview.focus();

      fireEvent.keyDown(overview, { key: 'End' });

      expect(document.activeElement).toBe(resources);

      fireEvent.keyDown(resources, { key: 'Home' });

      expect(document.activeElement).toBe(overview);
    });
  });

  describe('shared Tooltip integration', () => {
    it('displays the tooltip when its trigger receives pointer hover', () => {
      renderApp();

      const trigger = screen.getByRole('button', {
        name: 'Hover or focus for help',
      });

      fireEvent.mouseEnter(trigger);

      expect(screen.getByRole('tooltip')).toBeTruthy();

      expect(
        screen.getByText('This is a shared Gurusthalam tooltip.'),
      ).toBeTruthy();
    });

    it('hides the tooltip when the pointer leaves its trigger', () => {
      renderApp();

      const trigger = screen.getByRole('button', {
        name: 'Hover or focus for help',
      });

      fireEvent.mouseEnter(trigger);

      expect(screen.getByRole('tooltip')).toBeTruthy();

      fireEvent.mouseLeave(trigger);

      expect(screen.queryByRole('tooltip')).toBeNull();
    });

    it('displays the tooltip when its trigger receives keyboard focus', () => {
      renderApp();

      const trigger = screen.getByRole('button', {
        name: 'Hover or focus for help',
      });

      fireEvent.focus(trigger);

      expect(screen.getByRole('tooltip')).toBeTruthy();

      expect(trigger.getAttribute('aria-describedby')).toContain(
        screen.getByRole('tooltip').id,
      );
    });

    it('dismisses the focused tooltip with Escape', () => {
      renderApp();

      const trigger = screen.getByRole('button', {
        name: 'Hover or focus for help',
      });

      fireEvent.focus(trigger);

      expect(screen.getByRole('tooltip')).toBeTruthy();

      fireEvent.keyDown(trigger, { key: 'Escape' });

      expect(screen.queryByRole('tooltip')).toBeNull();
    });
  });

  describe('shared Dropdown Menu integration', () => {
    it('opens the Dropdown Menu using its trigger', () => {
      renderApp();

      const trigger = screen.getByRole('button', {
        name: 'Course actions',
      });

      fireEvent.click(trigger);

      expect(screen.getByRole('menu')).toBeTruthy();
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });

    it('renders the available course actions', () => {
      renderApp();

      fireEvent.click(screen.getByRole('button', { name: 'Course actions' }));

      expect(
        screen.getByRole('menuitem', { name: 'Edit Course' }),
      ).toBeTruthy();

      expect(
        screen.getByRole('menuitem', { name: 'Duplicate Course' }),
      ).toBeTruthy();

      expect(
        screen.getByRole('menuitem', { name: 'Archive Course' }),
      ).toBeTruthy();
    });

    it('executes the selected course action and closes the menu', () => {
      renderApp();

      fireEvent.click(screen.getByRole('button', { name: 'Course actions' }));

      fireEvent.click(screen.getByRole('menuitem', { name: 'Edit Course' }));

      expect(
        screen.getByText('Edit Course action selected successfully.'),
      ).toBeTruthy();

      expect(screen.queryByRole('menu')).toBeNull();
    });

    it('does not execute a disabled menu action', () => {
      renderApp();

      fireEvent.click(screen.getByRole('button', { name: 'Course actions' }));

      const disabledItem = screen.getByRole('menuitem', {
        name: 'Disabled action',
      });

      fireEvent.click(disabledItem);

      expect(screen.getByText('No dropdown action selected yet.')).toBeTruthy();

      expect(screen.getByRole('menu')).toBeTruthy();
    });

    it('opens the menu with ArrowDown from its trigger', () => {
      renderApp();

      const trigger = screen.getByRole('button', {
        name: 'Course actions',
      });

      fireEvent.keyDown(trigger, { key: 'ArrowDown' });

      expect(screen.getByRole('menu')).toBeTruthy();
    });

    it('closes the menu with Escape and restores trigger focus', () => {
      renderApp();

      const trigger = screen.getByRole('button', {
        name: 'Course actions',
      });

      fireEvent.click(trigger);

      const menu = screen.getByRole('menu');

      fireEvent.keyDown(menu, { key: 'Escape' });

      expect(screen.queryByRole('menu')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });

    it('supports keyboard navigation between menu items', () => {
      renderApp();

      fireEvent.click(screen.getByRole('button', { name: 'Course actions' }));

      const menu = screen.getByRole('menu');
      const firstItem = screen.getByRole('menuitem', {
        name: 'Edit Course',
      });
      const secondItem = screen.getByRole('menuitem', {
        name: 'Duplicate Course',
      });

      firstItem.focus();

      fireEvent.keyDown(menu, { key: 'ArrowDown' });

      expect(document.activeElement).toBe(secondItem);

      fireEvent.keyDown(menu, { key: 'Home' });

      expect(document.activeElement).toBe(firstItem);

      fireEvent.keyDown(menu, { key: 'End' });

      expect(document.activeElement).toBe(
        screen.getByRole('menuitem', { name: 'Archive Course' }),
      );
    });

    it('closes the menu when clicking outside', () => {
      renderApp();

      fireEvent.click(screen.getByRole('button', { name: 'Course actions' }));

      expect(screen.getByRole('menu')).toBeTruthy();

      fireEvent.pointerDown(
        screen.getByRole('heading', { name: 'Learner workspace' }),
      );

      expect(screen.queryByRole('menu')).toBeNull();
    });
  });
});
