import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  CommandMenu,
  CommandMenuEmpty,
  CommandMenuGroup,
  CommandMenuInput,
  CommandMenuItem,
  CommandMenuList,
  CommandMenuSeparator,
} from './CommandMenu.js';

function renderCommandMenu({
  onOpenChange = vi.fn(),
  onSelect = vi.fn(),
  defaultOpen = true,
}: {
  onOpenChange?: (open: boolean) => void;
  onSelect?: () => void;
  defaultOpen?: boolean;
} = {}) {
  render(
    <>
      <button type="button">Outside control</button>

      <CommandMenu
        defaultOpen={defaultOpen}
        onOpenChange={onOpenChange}
        onSelect={onSelect}
      >
        <CommandMenuInput aria-label="Search commands" />

        <CommandMenuList>
          <CommandMenuGroup heading="Navigation">
            <CommandMenuItem value="dashboard" onSelect={onSelect}>
              Dashboard
            </CommandMenuItem>

            <CommandMenuItem value="courses" onSelect={onSelect}>
              Courses
            </CommandMenuItem>
          </CommandMenuGroup>

          <CommandMenuSeparator />

          <CommandMenuGroup heading="Actions">
            <CommandMenuItem value="settings" onSelect={onSelect}>
              Settings
            </CommandMenuItem>

            <CommandMenuItem value="archived" disabled>
              Archived
            </CommandMenuItem>
          </CommandMenuGroup>

          <CommandMenuEmpty>No matching commands.</CommandMenuEmpty>
        </CommandMenuList>
      </CommandMenu>
    </>,
  );

  return { onOpenChange, onSelect };
}

describe('CommandMenu', () => {
  it('renders the command menu when initially open', () => {
    renderCommandMenu();

    expect(screen.getByRole('combobox')).toBeTruthy();
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('does not render when initially closed', () => {
    renderCommandMenu({ defaultOpen: false });

    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('focuses the search input when opened', async () => {
    renderCommandMenu();

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('combobox'));
    });
  });

  it('renders command groups and their headings', () => {
    renderCommandMenu();

    expect(screen.getByRole('group', { name: 'Navigation' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Actions' })).toBeTruthy();
  });

  it('renders command items and separators', () => {
    renderCommandMenu();

    expect(screen.getByRole('option', { name: 'Dashboard' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Courses' })).toBeTruthy();
    expect(screen.getByRole('separator')).toBeTruthy();
  });

  it('filters commands using the search input', async () => {
    renderCommandMenu();

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'course' },
    });

    expect(screen.getByRole('option', { name: 'Courses' })).toBeTruthy();

    await waitFor(() => {
      expect(screen.queryByRole('option', { name: 'Dashboard' })).toBeNull();
      expect(screen.queryByRole('option', { name: 'Settings' })).toBeNull();
    });
  });

  it('matches search values without case sensitivity', () => {
    renderCommandMenu();

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'DASH' },
    });

    expect(screen.getByRole('option', { name: 'Dashboard' })).toBeTruthy();
  });

  it('shows the empty state when no commands match', async () => {
    renderCommandMenu();

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'not-a-command' },
    });

    expect((await screen.findByRole('status')).textContent).toBe(
      'No matching commands.',
    );
  });

  it('hides the empty state when the search is cleared', async () => {
    renderCommandMenu();

    const input = screen.getByRole('combobox');

    fireEvent.change(input, {
      target: { value: 'not-a-command' },
    });

    expect(await screen.findByRole('status')).toBeTruthy();

    fireEvent.change(input, { target: { value: '' } });

    await waitFor(() => {
      expect(screen.queryByRole('status')).toBeNull();
    });
  });

  it('selects an enabled command and closes the menu', () => {
    const onSelect = vi.fn();

    renderCommandMenu({ onSelect });

    fireEvent.click(screen.getByRole('option', { name: 'Dashboard' }));

    expect(onSelect).toHaveBeenCalled();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('does not select a disabled command', () => {
    const onSelect = vi.fn();

    renderCommandMenu({ onSelect });

    fireEvent.click(screen.getByRole('option', { name: 'Archived' }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox')).toBeTruthy();
  });

  it('moves the active command with ArrowDown', () => {
    renderCommandMenu();

    const input = screen.getByRole('combobox');
    const dashboard = screen.getByRole('option', { name: 'Dashboard' });
    const courses = screen.getByRole('option', { name: 'Courses' });

    fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(dashboard.getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(courses.getAttribute('aria-selected')).toBe('true');
  });

  it('moves to the last enabled command with ArrowUp from the start', () => {
    renderCommandMenu();

    const input = screen.getByRole('combobox');
    const settings = screen.getByRole('option', { name: 'Settings' });

    fireEvent.keyDown(input, { key: 'ArrowUp' });

    expect(settings.getAttribute('aria-selected')).toBe('true');
  });

  it('selects the active command with Enter', () => {
    const onSelect = vi.fn();

    renderCommandMenu({ onSelect });

    const input = screen.getByRole('combobox');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalled();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('closes on Escape', () => {
    const onOpenChange = vi.fn();

    renderCommandMenu({ onOpenChange });

    fireEvent.keyDown(screen.getByRole('combobox'), {
      key: 'Escape',
    });

    expect(screen.queryByRole('combobox')).toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes when the user clicks outside the menu', () => {
    renderCommandMenu();

    fireEvent.pointerDown(
      screen.getByRole('button', { name: 'Outside control' }),
    );

    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('supports controlled open state', () => {
    const onOpenChange = vi.fn();

    render(
      <CommandMenu open onOpenChange={onOpenChange}>
        <CommandMenuInput />
        <CommandMenuList>
          <CommandMenuItem value="dashboard">Dashboard</CommandMenuItem>
        </CommandMenuList>
      </CommandMenu>,
    );

    fireEvent.keyDown(screen.getByRole('combobox'), {
      key: 'Escape',
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByRole('combobox')).toBeTruthy();
  });

  it('supports custom classes and HTML attributes', () => {
    render(
      <CommandMenu
        defaultOpen
        className="custom-command-menu"
        data-testid="custom-command-menu"
      >
        <CommandMenuInput className="custom-input" />
        <CommandMenuList>
          <CommandMenuItem value="dashboard" data-testid="custom-item">
            Dashboard
          </CommandMenuItem>
        </CommandMenuList>
      </CommandMenu>,
    );

    expect(screen.getByTestId('custom-command-menu').className).toContain(
      'custom-command-menu',
    );

    expect(screen.getByRole('combobox').className).toContain('custom-input');

    expect(screen.getByTestId('custom-item')).toBeTruthy();
  });

  it('notifies the owner when a command is selected', () => {
    const onOpenChange = vi.fn();

    render(
      <CommandMenu defaultOpen onOpenChange={onOpenChange}>
        <CommandMenuInput />
        <CommandMenuList>
          <CommandMenuItem value="dashboard">Dashboard</CommandMenuItem>
        </CommandMenuList>
      </CommandMenu>,
    );

    fireEvent.click(screen.getByRole('option', { name: 'Dashboard' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
