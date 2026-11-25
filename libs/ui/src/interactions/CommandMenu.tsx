import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type KeyboardEvent,
  type RefObject,
} from 'react';

interface CommandMenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  query: string;
  setQuery: (query: string) => void;
  activeItemId: string | null;
  setActiveItemId: (id: string | null) => void;
  inputId: string;
  listId: string;
  rootRef: RefObject<HTMLDivElement | null>;
  matchingCount: number;
  registerItem: (id: string, matches: boolean) => void;
  unregisterItem: (id: string) => void;
  selectItem: () => void;
}

const CommandMenuContext = createContext<CommandMenuContextValue | null>(null);

function useCommandMenuContext(componentName: string) {
  const context = useContext(CommandMenuContext);

  if (!context) {
    throw new Error(`${componentName} must be used inside CommandMenu.`);
  }

  return context;
}

export interface CommandMenuProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSelect?: () => void;
}

export function CommandMenu({
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  onSelect,
  className,
  ...props
}: CommandMenuProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const [query, setQuery] = useState('');
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [matchingItems, setMatchingItems] = useState<Map<string, boolean>>(
    () => new Map(),
  );

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen === open) {
        return;
      }

      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }

      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange, open],
  );

  const registerItem = useCallback((itemId: string, matches: boolean) => {
    setMatchingItems((current) => {
      if (current.get(itemId) === matches) {
        return current;
      }

      const next = new Map(current);
      next.set(itemId, matches);
      return next;
    });
  }, []);

  const unregisterItem = useCallback((itemId: string) => {
    setMatchingItems((current) => {
      if (!current.has(itemId)) {
        return current;
      }

      const next = new Map(current);
      next.delete(itemId);
      return next;
    });
  }, []);

  const selectItem = useCallback(() => {
    onSelect?.();
    setOpen(false);
  }, [onSelect, setOpen]);

  const inputId = `${id}-input`;
  const listId = `${id}-list`;

  useEffect(() => {
    if (!open) {
      return;
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const input = rootRef.current?.querySelector<HTMLInputElement>(
      '[data-command-input="true"]',
    );

    input?.focus();

    function handlePointerDown(event: PointerEvent) {
      const root = rootRef.current;

      if (
        root &&
        event.target instanceof Node &&
        !root.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);

      const previousFocus = previousFocusRef.current;

      if (previousFocus?.isConnected) {
        previousFocus.focus();
      }

      previousFocusRef.current = null;
    };
  }, [open, setOpen]);

  const context: CommandMenuContextValue = {
    open,
    setOpen,
    query,
    setQuery,
    activeItemId,
    setActiveItemId,
    inputId,
    listId,
    rootRef,
    matchingCount: Array.from(matchingItems.values()).filter(Boolean).length,
    registerItem,
    unregisterItem,
    selectItem,
  };

  if (!open) {
    return null;
  }

  return (
    <CommandMenuContext.Provider value={context}>
      <div
        {...props}
        ref={rootRef}
        className={['gt-command-menu', className ?? '']
          .filter(Boolean)
          .join(' ')}
        data-command-menu="true"
      >
        {children}
      </div>
    </CommandMenuContext.Provider>
  );
}

export interface CommandMenuInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
> {
  onValueChange?: (value: string) => void;
}

export function CommandMenuInput({
  className,
  onValueChange,
  onKeyDown,
  placeholder = 'Type a command or search...',
  ...props
}: CommandMenuInputProps) {
  const context = useCommandMenuContext('CommandMenuInput');

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(event);

    if (event.defaultPrevented) {
      return;
    }

    const items = Array.from(
      context.rootRef.current?.querySelectorAll<HTMLButtonElement>(
        '[data-command-item="true"]:not(:disabled)',
      ) ?? [],
    );

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (items.length === 0) {
        return;
      }

      event.preventDefault();

      const currentIndex = items.findIndex(
        (item) => item.id === context.activeItemId,
      );

      const nextIndex =
        event.key === 'ArrowDown'
          ? (currentIndex + 1) % items.length
          : currentIndex <= 0
            ? items.length - 1
            : currentIndex - 1;

      const nextItem = items[nextIndex];

      if (nextItem) {
        context.setActiveItemId(nextItem.id);
      }

      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();

      const activeItem = items.find((item) => item.id === context.activeItemId);

      activeItem?.click();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      context.setOpen(false);
    }
  }

  return (
    <div className="gt-command-menu__input-wrapper">
      <span className="gt-command-menu__search-icon" aria-hidden="true">
        ⌕
      </span>

      <input
        {...props}
        id={context.inputId}
        data-command-input="true"
        className={['gt-command-menu__input', className ?? '']
          .filter(Boolean)
          .join(' ')}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded="true"
        aria-controls={context.listId}
        aria-activedescendant={context.activeItemId ?? undefined}
        placeholder={placeholder}
        value={context.query}
        onChange={(event) => {
          const nextValue = event.currentTarget.value;

          context.setQuery(nextValue);
          context.setActiveItemId(null);
          onValueChange?.(nextValue);
        }}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}

export interface CommandMenuListProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CommandMenuList({
  children,
  className,
  ...props
}: CommandMenuListProps) {
  const context = useCommandMenuContext('CommandMenuList');

  return (
    <div
      {...props}
      id={context.listId}
      role="listbox"
      aria-label="Commands"
      className={['gt-command-menu__list', className ?? '']
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}

export interface CommandMenuGroupProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  heading?: string;
}

export function CommandMenuGroup({
  children,
  heading,
  className,
  ...props
}: CommandMenuGroupProps) {
  const headingId = useId();

  return (
    <div
      {...props}
      role="group"
      aria-labelledby={heading ? headingId : undefined}
      className={['gt-command-menu__group', className ?? '']
        .filter(Boolean)
        .join(' ')}
    >
      {heading ? (
        <div id={headingId} className="gt-command-menu__group-heading">
          {heading}
        </div>
      ) : null}

      {children}
    </div>
  );
}

export interface CommandMenuItemProps extends Omit<
  HTMLAttributes<HTMLButtonElement>,
  'onSelect'
> {
  children: ReactNode;
  value: string;
  disabled?: boolean;
  onSelect?: () => void;
}

export function CommandMenuItem({
  children,
  value,
  disabled = false,
  onSelect,
  className,
  onClick,
  onMouseMove,
  ...props
}: CommandMenuItemProps) {
  const context = useCommandMenuContext('CommandMenuItem');
  const id = useId();

  const matches =
    context.query.trim().length === 0 ||
    value
      .toLocaleLowerCase()
      .includes(context.query.trim().toLocaleLowerCase());

  useEffect(() => {
    context.registerItem(id, matches);

    return () => {
      context.unregisterItem(id);
    };
  }, [context.registerItem, context.unregisterItem, id, matches]);

  useEffect(() => {
    if (!matches && context.activeItemId === id) {
      context.setActiveItemId(null);
    }
  }, [context.activeItemId, context.setActiveItemId, id, matches]);

  if (!matches) {
    return null;
  }

  return (
    <button
      {...props}
      id={id}
      type="button"
      role="option"
      aria-selected={context.activeItemId === id}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      data-command-item="true"
      className={[
        'gt-command-menu__item',
        context.activeItemId === id ? 'gt-command-menu__item--active' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      onMouseMove={(event) => {
        onMouseMove?.(event);

        if (!event.defaultPrevented && !disabled) {
          context.setActiveItemId(id);
        }
      }}
      onClick={(event) => {
        onClick?.(event);

        if (event.defaultPrevented || disabled) {
          return;
        }

        onSelect?.();
        context.selectItem();
      }}
    >
      {children}
    </button>
  );
}

export type CommandMenuSeparatorProps = HTMLAttributes<HTMLDivElement>;

export function CommandMenuSeparator({
  className,
  ...props
}: CommandMenuSeparatorProps) {
  return (
    <div
      {...props}
      role="separator"
      className={['gt-command-menu__separator', className ?? '']
        .filter(Boolean)
        .join(' ')}
    />
  );
}

export interface CommandMenuEmptyProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

export function CommandMenuEmpty({
  children = 'No commands found.',
  className,
  ...props
}: CommandMenuEmptyProps) {
  const context = useCommandMenuContext('CommandMenuEmpty');

  if (!context.query.trim() || context.matchingCount > 0) {
    return null;
  }

  return (
    <div
      {...props}
      role="status"
      className={['gt-command-menu__empty', className ?? '']
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
