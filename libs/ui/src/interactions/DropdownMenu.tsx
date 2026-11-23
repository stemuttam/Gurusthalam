import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

interface DropdownMenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  menuId: string;
  triggerId: string;
  focusItem: (position: 'first' | 'last') => void;
}

const DropdownMenuContext = createContext<DropdownMenuContextValue | null>(
  null,
);

function useDropdownMenuContext(componentName: string) {
  const context = useContext(DropdownMenuContext);

  if (!context) {
    throw new Error(`${componentName} must be used inside DropdownMenu.`);
  }

  return context;
}

const MENU_ITEM_SELECTOR =
  '[role="menuitem"]:not([aria-disabled="true"]):not([disabled])';

export interface DropdownMenuProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  defaultOpen?: boolean;
}

export function DropdownMenu({
  children,
  defaultOpen = false,
  className,
  ...props
}: DropdownMenuProps) {
  const id = useId();
  const [open, setOpen] = useState(defaultOpen);
  const rootRef = useRef<HTMLDivElement>(null);

  const menuId = `${id}-menu`;
  const triggerId = `${id}-trigger`;

  function focusItem(position: 'first' | 'last') {
    requestAnimationFrame(() => {
      const items =
        rootRef.current?.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR);

      if (!items?.length) {
        return;
      }

      const target = position === 'first' ? items[0] : items[items.length - 1];

      target?.focus();
    });
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open]);

  const context: DropdownMenuContextValue = {
    open,
    setOpen,
    menuId,
    triggerId,
    focusItem,
  };

  return (
    <DropdownMenuContext.Provider value={context}>
      <div
        {...props}
        ref={rootRef}
        className={['gt-dropdown', className ?? ''].filter(Boolean).join(' ')}
      >
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
}

export interface DropdownMenuTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function DropdownMenuTrigger({
  children,
  className,
  onClick,
  onKeyDown,
  ...props
}: DropdownMenuTriggerProps) {
  const context = useDropdownMenuContext('DropdownMenuTrigger');

  return (
    <button
      {...props}
      id={context.triggerId}
      type="button"
      className={['gt-dropdown__trigger', className ?? '']
        .filter(Boolean)
        .join(' ')}
      aria-haspopup="menu"
      aria-expanded={context.open}
      aria-controls={context.menuId}
      onClick={(event) => {
        onClick?.(event);

        if (event.defaultPrevented) {
          return;
        }

        const nextOpen = !context.open;
        context.setOpen(nextOpen);

        if (nextOpen) {
          context.focusItem('first');
        }
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);

        if (event.defaultPrevented) {
          return;
        }

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          context.setOpen(true);
          context.focusItem('first');
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          context.setOpen(true);
          context.focusItem('last');
        }
      }}
    >
      {children}
    </button>
  );
}

export interface DropdownMenuContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  align?: 'start' | 'end';
}

export function DropdownMenuContent({
  children,
  align = 'start',
  className,
  onKeyDown,
  ...props
}: DropdownMenuContentProps) {
  const context = useDropdownMenuContext('DropdownMenuContent');

  if (!context.open) {
    return null;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event);

    if (event.defaultPrevented) {
      return;
    }

    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR),
    );

    const currentIndex = items.indexOf(document.activeElement as HTMLElement);

    if (event.key === 'Escape') {
      event.preventDefault();
      context.setOpen(false);
      document.getElementById(context.triggerId)?.focus();
      return;
    }

    if (event.key === 'Tab') {
  context.setOpen(false);
  return;
}

    if (items.length === 0) {
      return;
    }

    let nextIndex = currentIndex;

    if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = items.length - 1;
    } else if (event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1 + items.length) % items.length;
    } else if (event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + items.length) % items.length;
    } else {
      return;
    }

    event.preventDefault();
    items[nextIndex]?.focus();
  }

  return (
    <div
      {...props}
      id={context.menuId}
      className={[
        'gt-dropdown__content',
        `gt-dropdown__content--${align}`,
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="menu"
      aria-labelledby={context.triggerId}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}

export interface DropdownMenuItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  onSelect?: () => void;
}

export function DropdownMenuItem({
  children,
  onSelect,
  disabled = false,
  className,
  onClick,
  ...props
}: DropdownMenuItemProps) {
  const context = useDropdownMenuContext('DropdownMenuItem');

  return (
    <button
      {...props}
      type="button"
      role="menuitem"
      tabIndex={-1}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      className={['gt-dropdown__item', className ?? '']
        .filter(Boolean)
        .join(' ')}
      onClick={(event) => {
        onClick?.(event);

        if (event.defaultPrevented || disabled) {
          return;
        }

        onSelect?.();
        context.setOpen(false);
        document.getElementById(context.triggerId)?.focus();
      }}
    >
      {children}
    </button>
  );
}

export type DropdownMenuSeparatorProps = HTMLAttributes<HTMLDivElement>;

export function DropdownMenuSeparator({
  className,
  ...props
}: DropdownMenuSeparatorProps) {
  return (
    <div
      {...props}
      role="separator"
      className={['gt-dropdown__separator', className ?? '']
        .filter(Boolean)
        .join(' ')}
    />
  );
}
