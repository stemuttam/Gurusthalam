
import {
  useEffect,
  useId,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export interface DialogProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'title'
> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  closeOnOverlayClick?: boolean;
  showCloseButton?: boolean;
  closeLabel?: string;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => {
    if (
      element.hasAttribute('disabled') ||
      element.getAttribute('aria-disabled') === 'true' ||
      element.getAttribute('aria-hidden') === 'true'
    ) {
      return false;
    }

    if (element.closest('[hidden], [inert]')) {
      return false;
    }

    const computedStyle = window.getComputedStyle(element);

    if (
      computedStyle.display === 'none' ||
      computedStyle.visibility === 'hidden' ||
      computedStyle.visibility === 'collapse'
    ) {
      return false;
    }

    return element.getClientRects().length > 0;
  });
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  closeOnOverlayClick = true,
  showCloseButton = true,
  closeLabel = 'Close dialog',
  className,
  onMouseDown,
  ...props
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const dialog = dialogRef.current;

    if (dialog) {
      const focusableElements = getFocusableElements(dialog);
      (focusableElements[0] ?? dialog).focus();
    }

    function handleKeyDown(event: KeyboardEvent) {
      const currentDialog = dialogRef.current;

      if (!currentDialog) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onOpenChange(false);
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const elements = getFocusableElements(currentDialog);

      if (elements.length === 0) {
        event.preventDefault();
        currentDialog.focus();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];

      if (!first || !last) {
        return;
      }

      const activeElement = document.activeElement;

      if (
        event.shiftKey &&
        (activeElement === first || !currentDialog.contains(activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (activeElement === last || !currentDialog.contains(activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    }

    function handleFocusIn(event: FocusEvent) {
      const currentDialog = dialogRef.current;

      if (
        currentDialog &&
        event.target instanceof Node &&
        !currentDialog.contains(event.target)
      ) {
        const focusableElements = getFocusableElements(currentDialog);
        (focusableElements[0] ?? currentDialog).focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusIn);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusIn);

      document.body.style.overflow = previousOverflow;

      const previousFocus = previousFocusRef.current;

      if (previousFocus?.isConnected) {
        previousFocus.focus();
      }

      previousFocusRef.current = null;
    };
  }, [open, onOpenChange]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  const classes = ['gt-dialog', className ?? '']
    .filter(Boolean)
    .join(' ');

  return createPortal(
    <div
      className="gt-dialog-overlay"
      data-testid="gt-dialog-overlay"
      onMouseDown={(event) => {
        onMouseDown?.(event);

        if (event.defaultPrevented) {
          return;
        }

        if (
          closeOnOverlayClick &&
          event.target === event.currentTarget
        ) {
          onOpenChange(false);
        }
      }}
    >
      <div
        {...props}
        ref={dialogRef}
        className={classes}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <header className="gt-dialog__header">
          <div className="gt-dialog__heading">
            <h2 id={titleId} className="gt-dialog__title">
              {title}
            </h2>

            {description ? (
              <p
                id={descriptionId}
                className="gt-dialog__description"
              >
                {description}
              </p>
            ) : null}
          </div>

          {showCloseButton ? (
            <button
              type="button"
              className="gt-dialog__close"
              aria-label={closeLabel}
              onClick={() => onOpenChange(false)}
            >
              <span aria-hidden="true">×</span>
            </button>
          ) : null}
        </header>

        <div className="gt-dialog__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
