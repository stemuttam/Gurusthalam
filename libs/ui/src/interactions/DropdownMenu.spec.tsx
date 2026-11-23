
import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './DropdownMenu.js';

describe('DropdownMenu', () => {
  function renderMenu(onSelect = vi.fn()) {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Course actions</DropdownMenuTrigger>

        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onSelect}>
            Edit course
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onSelect}>
            Duplicate course
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>Archived action</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    return onSelect;
  }

  it('starts closed and opens when its trigger is activated', () => {
    renderMenu();

    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Course actions' }));

    expect(screen.getByRole('menu')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Course actions' }).getAttribute(
        'aria-expanded',
      ),
    ).toBe('true');
  });

  it('renders menu items and separators with semantic roles', () => {
    renderMenu();

    fireEvent.click(screen.getByRole('button', { name: 'Course actions' }));

    expect(screen.getByRole('menuitem', { name: 'Edit course' })).toBeTruthy();
    expect(
      screen.getByRole('menuitem', { name: 'Duplicate course' }),
    ).toBeTruthy();
    expect(screen.getByRole('separator')).toBeTruthy();
  });

  it('calls onSelect and closes the menu after selecting an item', () => {
    const onSelect = renderMenu();

    fireEvent.click(screen.getByRole('button', { name: 'Course actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit course' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('does not select a disabled item', () => {
    const onSelect = renderMenu();

    fireEvent.click(screen.getByRole('button', { name: 'Course actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Archived action' }));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('closes on Escape and restores focus to the trigger', () => {
    renderMenu();

    const trigger = screen.getByRole('button', { name: 'Course actions' });

    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });

    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('supports ArrowDown and Home movement between menu items', () => {
    renderMenu();

    fireEvent.click(screen.getByRole('button', { name: 'Course actions' }));

    const menu = screen.getByRole('menu');
    const firstItem = screen.getByRole('menuitem', { name: 'Edit course' });
    const secondItem = screen.getByRole('menuitem', {
      name: 'Duplicate course',
    });

    firstItem.focus();
    fireEvent.keyDown(menu, { key: 'ArrowDown' });

    expect(document.activeElement).toBe(secondItem);

    fireEvent.keyDown(menu, { key: 'Home' });

    expect(document.activeElement).toBe(firstItem);
  });

  it('supports ArrowUp and End movement between menu items', () => {
    renderMenu();

    fireEvent.click(screen.getByRole('button', { name: 'Course actions' }));

    const menu = screen.getByRole('menu');
    const firstItem = screen.getByRole('menuitem', { name: 'Edit course' });
    const secondItem = screen.getByRole('menuitem', {
      name: 'Duplicate course',
    });

    firstItem.focus();
    fireEvent.keyDown(menu, { key: 'ArrowUp' });

    expect(document.activeElement).toBe(secondItem);

    fireEvent.keyDown(menu, { key: 'End' });

    expect(document.activeElement).toBe(secondItem);
  });

  it('supports opening the menu with ArrowDown from its trigger', () => {
    renderMenu();

    const trigger = screen.getByRole('button', { name: 'Course actions' });

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });

    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('supports opening the menu with ArrowUp from its trigger', () => {
    renderMenu();

    const trigger = screen.getByRole('button', { name: 'Course actions' });

    fireEvent.keyDown(trigger, { key: 'ArrowUp' });

    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('closes when the user clicks outside the menu', () => {
    render(
      <>
        <button type="button">Outside target</button>

        <DropdownMenu>
          <DropdownMenuTrigger>Course actions</DropdownMenuTrigger>

          <DropdownMenuContent>
            <DropdownMenuItem>Edit course</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Course actions' }));

    expect(screen.getByRole('menu')).toBeTruthy();

    fireEvent.pointerDown(
      screen.getByRole('button', { name: 'Outside target' }),
    );

    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on Tab without preventing normal focus movement', () => {
  renderMenu();

  fireEvent.click(screen.getByRole('button', { name: 'Course actions' }));

  const menu = screen.getByRole('menu');

  expect(menu).toBeTruthy();

  const event = createEvent.keyDown(menu, {
    key: 'Tab',
    bubbles: true,
    cancelable: true,
  });

  fireEvent(menu, event);

  expect(screen.queryByRole('menu')).toBeNull();
  expect(event.defaultPrevented).toBe(false);
});
});
