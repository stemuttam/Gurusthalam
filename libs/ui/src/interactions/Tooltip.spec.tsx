
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Tooltip } from './Tooltip.js';

describe('Tooltip', () => {
  it('does not display its content before interaction', () => {
    render(
      <Tooltip content="Save your changes">
        <button type="button">Save</button>
      </Tooltip>,
    );

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('displays its content on pointer hover', () => {
    render(
      <Tooltip content="Save your changes">
        <button type="button">Save</button>
      </Tooltip>,
    );

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('tooltip').textContent).toBe(
      'Save your changes',
    );
  });

  it('hides its content when the pointer leaves', () => {
    render(
      <Tooltip content="Save your changes">
        <button type="button">Save</button>
      </Tooltip>,
    );

    const trigger = screen.getByRole('button', { name: 'Save' });

    fireEvent.mouseEnter(trigger);
    fireEvent.mouseLeave(trigger);

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('displays its content when the trigger receives keyboard focus', () => {
    render(
      <Tooltip content="Keyboard help">
        <button type="button">Help</button>
      </Tooltip>,
    );

    fireEvent.focus(screen.getByRole('button', { name: 'Help' }));

    expect(screen.getByRole('tooltip').textContent).toBe('Keyboard help');
  });

  it('associates the trigger with the visible tooltip', () => {
    render(
      <Tooltip content="Additional information">
        <button type="button">Information</button>
      </Tooltip>,
    );

    const trigger = screen.getByRole('button', { name: 'Information' });

    fireEvent.focus(trigger);

    const tooltip = screen.getByRole('tooltip');

    expect(trigger.getAttribute('aria-describedby')).toContain(tooltip.id);
  });

  it('preserves an existing aria-describedby value', () => {
    render(
      <Tooltip content="Additional information">
        <button type="button" aria-describedby="existing-description">
          Information
        </button>
      </Tooltip>,
    );

    const trigger = screen.getByRole('button', { name: 'Information' });

    fireEvent.focus(trigger);

    const tooltip = screen.getByRole('tooltip');
    const describedBy = trigger.getAttribute('aria-describedby') ?? '';

    expect(describedBy).toContain('existing-description');
    expect(describedBy).toContain(tooltip.id);
  });

  it('closes when Escape is pressed', () => {
    render(
      <Tooltip content="Keyboard help">
        <button type="button">Help</button>
      </Tooltip>,
    );

    const trigger = screen.getByRole('button', { name: 'Help' });

    fireEvent.focus(trigger);

    expect(screen.getByRole('tooltip')).toBeTruthy();

    fireEvent.keyDown(trigger, { key: 'Escape' });

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('composes the child focus and blur handlers', () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();

    render(
      <Tooltip content="Keyboard help">
        <button type="button" onFocus={onFocus} onBlur={onBlur}>
          Help
        </button>
      </Tooltip>,
    );

    const trigger = screen.getByRole('button', { name: 'Help' });

    fireEvent.focus(trigger);

    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('tooltip')).toBeTruthy();

    fireEvent.blur(trigger);

    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('composes the child mouse event handlers', () => {
    const onMouseEnter = vi.fn();
    const onMouseLeave = vi.fn();

    render(
      <Tooltip content="Pointer help">
        <button
          type="button"
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          Help
        </button>
      </Tooltip>,
    );

    const trigger = screen.getByRole('button', { name: 'Help' });

    fireEvent.mouseEnter(trigger);

    expect(onMouseEnter).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('tooltip')).toBeTruthy();

    fireEvent.mouseLeave(trigger);

    expect(onMouseLeave).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('does not display when disabled', () => {
    render(
      <Tooltip content="Unavailable help" disabled>
        <button type="button">Disabled tooltip</button>
      </Tooltip>,
    );

    fireEvent.focus(
      screen.getByRole('button', { name: 'Disabled tooltip' }),
    );

    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
