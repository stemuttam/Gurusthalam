
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog.js';

const originalGetClientRects = HTMLElement.prototype.getClientRects;

beforeEach(() => {
  HTMLElement.prototype.getClientRects = function getClientRects() {
    if (this.hasAttribute('hidden') || this.closest('[hidden], [inert]')) {
      return [] as unknown as DOMRectList;
    }

    return [
      {
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        top: 0,
        right: 10,
        bottom: 10,
        left: 0,
        toJSON: () => ({}),
      },
    ] as unknown as DOMRectList;
  };
});

afterEach(() => {
  HTMLElement.prototype.getClientRects = originalGetClientRects;
  document.body.style.overflow = '';
});

describe('Dialog', () => {
  it('does not render while closed', () => {
    render(
      <Dialog open={false} onOpenChange={() => undefined} title="Confirm">
        Dialog content
      </Dialog>,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders an accessible modal with its title and description', () => {
    render(
      <Dialog
        open
        onOpenChange={() => undefined}
        title="Delete course"
        description="This action cannot be undone."
      >
        Confirm deletion
      </Dialog>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Delete course' });

    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByText('This action cannot be undone.')).toBeTruthy();
    expect(screen.getByText('Confirm deletion')).toBeTruthy();
  });

  it('does not add aria-describedby when no description is supplied', () => {
    render(
      <Dialog open onOpenChange={() => undefined} title="Information">
        Content
      </Dialog>,
    );

    expect(
      screen.getByRole('dialog').hasAttribute('aria-describedby'),
    ).toBe(false);
  });

  it('renders the correctly encoded close icon', () => {
    render(
      <Dialog open onOpenChange={() => undefined} title="Edit profile">
        Profile form
      </Dialog>,
    );

    expect(screen.getByText('×')).toBeTruthy();
  });

  it('requests closure when the close button is activated', () => {
    const onOpenChange = vi.fn();

    render(
      <Dialog open onOpenChange={onOpenChange} title="Edit profile">
        Profile form
      </Dialog>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('requests closure on Escape', () => {
    const onOpenChange = vi.fn();

    render(
      <Dialog open onOpenChange={onOpenChange} title="Keyboard dialog">
        Content
      </Dialog>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('requests closure when the overlay itself is clicked', () => {
    const onOpenChange = vi.fn();

    render(
      <Dialog open onOpenChange={onOpenChange} title="Overlay dialog">
        Content
      </Dialog>,
    );

    fireEvent.mouseDown(screen.getByTestId('gt-dialog-overlay'));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not close when overlay dismissal is disabled', () => {
    const onOpenChange = vi.fn();

    render(
      <Dialog
        open
        onOpenChange={onOpenChange}
        title="Persistent dialog"
        closeOnOverlayClick={false}
      >
        Content
      </Dialog>,
    );

    fireEvent.mouseDown(screen.getByTestId('gt-dialog-overlay'));

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('does not close when the overlay mouse event is prevented', () => {
    const onOpenChange = vi.fn();

    render(
      <Dialog
        open
        onOpenChange={onOpenChange}
        onMouseDown={(event) => event.preventDefault()}
        title="Protected dialog"
      >
        Content
      </Dialog>,
    );

    fireEvent.mouseDown(screen.getByTestId('gt-dialog-overlay'));

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('moves initial focus to the first focusable control', () => {
    render(
      <Dialog open onOpenChange={() => undefined} title="Focus dialog">
        <button type="button">First action</button>
        <button type="button">Second action</button>
      </Dialog>,
    );

    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Close dialog' }),
    );
  });

  it('wraps forward Tab from the last control to the first control', () => {
    render(
      <Dialog open onOpenChange={() => undefined} title="Focus dialog">
        <button type="button">First action</button>
        <button type="button">Last action</button>
      </Dialog>,
    );

    const lastAction = screen.getByRole('button', { name: 'Last action' });
    const closeButton = screen.getByRole('button', { name: 'Close dialog' });

    lastAction.focus();
    fireEvent.keyDown(document, { key: 'Tab' });

    expect(document.activeElement).toBe(closeButton);
  });

  it('wraps backward Shift+Tab from the first control to the last control', () => {
    render(
      <Dialog open onOpenChange={() => undefined} title="Focus dialog">
        <button type="button">First action</button>
        <button type="button">Last action</button>
      </Dialog>,
    );

    const closeButton = screen.getByRole('button', { name: 'Close dialog' });
    const lastAction = screen.getByRole('button', { name: 'Last action' });

    closeButton.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(lastAction);
  });

  it('keeps focus inside the dialog when focus moves outside', () => {
    render(
      <>
        <button type="button">Outside control</button>
        <Dialog open onOpenChange={() => undefined} title="Focus dialog">
          <button type="button">Inside action</button>
        </Dialog>
      </>,
    );

    const closeButton = screen.getByRole('button', { name: 'Close dialog' });

    screen.getByRole('button', { name: 'Outside control' }).focus();

    expect(document.activeElement).toBe(closeButton);
  });

  it('locks body scrolling while open and restores the previous value on close', () => {
    document.body.style.overflow = 'auto';

    const { rerender } = render(
      <Dialog open onOpenChange={() => undefined} title="Scroll dialog">
        Content
      </Dialog>,
    );

    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <Dialog open={false} onOpenChange={() => undefined} title="Scroll dialog">
        Content
      </Dialog>,
    );

    expect(document.body.style.overflow).toBe('auto');
  });

  it('restores focus to the previously focused element when closed', () => {
    const { rerender } = render(
      <>
        <button type="button">Open dialog</button>
        <Dialog
          open={false}
          onOpenChange={() => undefined}
          title="Focus dialog"
        >
          Content
        </Dialog>
      </>,
    );

    const opener = screen.getByRole('button', { name: 'Open dialog' });

    opener.focus();

    rerender(
      <>
        <button type="button">Open dialog</button>
        <Dialog open onOpenChange={() => undefined} title="Focus dialog">
          Content
        </Dialog>
      </>,
    );

    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Close dialog' }),
    );

    rerender(
      <>
        <button type="button">Open dialog</button>
        <Dialog
          open={false}
          onOpenChange={() => undefined}
          title="Focus dialog"
        >
          Content
        </Dialog>
      </>,
    );

    expect(document.activeElement).toBe(opener);
  });

  it('supports hiding the close button', () => {
    render(
      <Dialog
        open
        onOpenChange={() => undefined}
        title="No close button"
        showCloseButton={false}
      >
        Content
      </Dialog>,
    );

    expect(
      screen.queryByRole('button', { name: 'Close dialog' }),
    ).toBeNull();
  });
});
