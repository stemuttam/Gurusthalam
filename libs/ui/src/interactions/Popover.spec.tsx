import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps, MouseEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Popover, PopoverContent, PopoverTrigger } from './Popover.js';

type RenderPopoverProps = Omit<ComponentProps<typeof Popover>, 'children'>;

describe('Popover', () => {
  function renderPopover(props: RenderPopoverProps = {}) {
    return render(
      <Popover {...props}>
        <PopoverTrigger>Open details</PopoverTrigger>

        <PopoverContent>
          <button type="button">Popover action</button>
          <p>Popover information</p>
        </PopoverContent>
      </Popover>,
    );
  }

  it('renders its trigger while keeping content closed initially', () => {
    renderPopover();

    expect(screen.getByRole('button', { name: 'Open details' })).toBeTruthy();

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens when the trigger is clicked', () => {
    renderPopover();

    fireEvent.click(screen.getByRole('button', { name: 'Open details' }));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Popover information')).toBeTruthy();
  });

  it('closes when the trigger is clicked again', () => {
    renderPopover();

    const trigger = screen.getByRole('button', {
      name: 'Open details',
    });

    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.click(trigger);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('supports an initially open uncontrolled state', () => {
    renderPopover({ defaultOpen: true });

    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('supports controlled open state', () => {
    const onOpenChange = vi.fn();

    renderPopover({
      open: true,
      onOpenChange,
    });

    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Open details' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);

    // A controlled component does not change until its owner updates open.
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('notifies the owner when a controlled popover is opened', () => {
    const onOpenChange = vi.fn();

    renderPopover({
      open: false,
      onOpenChange,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open details' }));

    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes when a pointer interaction occurs outside the popover', () => {
    renderPopover({ defaultOpen: true });

    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not close when a pointer interaction occurs inside the popover', () => {
    renderPopover({ defaultOpen: true });

    fireEvent.pointerDown(screen.getByText('Popover information'));

    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('closes on Escape and restores focus to the trigger', () => {
    renderPopover({ defaultOpen: true });

    const trigger = screen.getByRole('button', {
      name: 'Open details',
    });

    screen.getByRole('button', { name: 'Popover action' }).focus();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('exposes the trigger expanded state and content relationship', () => {
    renderPopover({ defaultOpen: true });

    const trigger = screen.getByRole('button', {
      name: 'Open details',
    });

    const content = screen.getByRole('dialog');

    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-controls')).toBe(content.id);
    expect(content.getAttribute('aria-labelledby')).toBe(trigger.id);
  });

  it('updates the trigger expanded state when opened', () => {
    renderPopover();

    const trigger = screen.getByRole('button', {
      name: 'Open details',
    });

    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(trigger);

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('does not open when the trigger is disabled', () => {
    render(
      <Popover>
        <PopoverTrigger disabled>Open details</PopoverTrigger>
        <PopoverContent>Details</PopoverContent>
      </Popover>,
    );

    const trigger = screen.getByRole('button', {
      name: 'Open details',
    });

    expect(trigger.hasAttribute('disabled')).toBe(true);

    fireEvent.click(trigger);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('supports side, alignment and offset configuration', () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>Open details</PopoverTrigger>

        <PopoverContent side="right" align="end" sideOffset={12}>
          Details
        </PopoverContent>
      </Popover>,
    );

    const content = screen.getByRole('dialog');

    expect(content.getAttribute('data-side')).toBe('right');
    expect(content.getAttribute('data-align')).toBe('end');

    expect(
      (content as HTMLDivElement).style.getPropertyValue(
        '--gt-popover-side-offset',
      ),
    ).toBe('12px');
  });

  it('composes the trigger click handler', () => {
    const onClick = vi.fn();

    render(
      <Popover>
        <PopoverTrigger onClick={onClick}>Open details</PopoverTrigger>

        <PopoverContent>Details</PopoverContent>
      </Popover>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open details' }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('respects preventDefault in the trigger click handler', () => {
    const onClick = vi.fn((event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
    });

    render(
      <Popover>
        <PopoverTrigger onClick={onClick}>Open details</PopoverTrigger>

        <PopoverContent>Details</PopoverContent>
      </Popover>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open details' }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('supports custom classes and HTML attributes', () => {
    render(
      <Popover className="custom-popover" data-testid="custom-popover-root">
        <PopoverTrigger className="custom-trigger">Open details</PopoverTrigger>

        <PopoverContent
          className="custom-content"
          data-testid="custom-popover-content"
        >
          Details
        </PopoverContent>
      </Popover>,
    );

    expect(screen.getByTestId('custom-popover-root').className).toContain(
      'custom-popover',
    );

    expect(
      screen.getByRole('button', { name: 'Open details' }).className,
    ).toContain('custom-trigger');

    fireEvent.click(screen.getByRole('button', { name: 'Open details' }));

    expect(screen.getByTestId('custom-popover-content').className).toContain(
      'custom-content',
    );
  });

  it('keeps nested popovers independent', () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>Parent</PopoverTrigger>

        <PopoverContent>
          <Popover>
            <PopoverTrigger>Child</PopoverTrigger>
            <PopoverContent>Child content</PopoverContent>
          </Popover>
        </PopoverContent>
      </Popover>,
    );

    expect(screen.getAllByRole('dialog')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Child' }));

    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    expect(screen.getByText('Child content')).toBeTruthy();
  });

  it('does not lock document body scrolling', () => {
    document.body.style.overflow = 'auto';

    renderPopover({ defaultOpen: true });

    expect(document.body.style.overflow).toBe('auto');
  });
});
