import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';

export type PopoverSide = 'top' | 'right' | 'bottom' | 'left';

export type PopoverAlign = 'start' | 'center' | 'end';

interface PopoverContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  contentId: string;
  triggerId: string;
  rootRef: RefObject<HTMLDivElement | null>;
}

const PopoverContext = createContext<PopoverContextValue | null>(null);

function usePopoverContext(componentName: string): PopoverContextValue {
  const context = useContext(PopoverContext);

  if (!context) {
    throw new Error(`${componentName} must be used inside Popover.`);
  }

  return context;
}

export interface PopoverProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Popover({
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  className,
  ...props
}: PopoverProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);

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

  const contentId = `${id}-content`;
  const triggerId = `${id}-trigger`;

  useEffect(() => {
    if (!open) {
      return;
    }

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

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') {
        return;
      }

      const root = rootRef.current;

      if (!root) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      setOpen(false);

      root
        .querySelector<HTMLButtonElement>('[data-popover-trigger="true"]')
        ?.focus();
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, setOpen]);

  const context: PopoverContextValue = {
    open,
    setOpen,
    contentId,
    triggerId,
    rootRef,
  };

  return (
    <PopoverContext.Provider value={context}>
      <div
        {...props}
        ref={rootRef}
        className={['gt-popover', className ?? ''].filter(Boolean).join(' ')}
      >
        {children}
      </div>
    </PopoverContext.Provider>
  );
}

export interface PopoverTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function PopoverTrigger({
  children,
  className,
  disabled = false,
  onClick,
  onKeyDown,
  ...props
}: PopoverTriggerProps) {
  const context = usePopoverContext('PopoverTrigger');

  return (
    <button
      {...props}
      id={context.triggerId}
      type="button"
      data-popover-trigger="true"
      className={['gt-popover__trigger', className ?? '']
        .filter(Boolean)
        .join(' ')}
      aria-haspopup="dialog"
      aria-expanded={context.open}
      aria-controls={context.contentId}
      disabled={disabled}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);

        if (event.defaultPrevented || disabled) {
          return;
        }

        context.setOpen(!context.open);
      }}
      onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
        onKeyDown?.(event);

        if (event.defaultPrevented || disabled) {
          return;
        }

        if (
          event.key === 'ArrowDown' ||
          event.key === 'Enter' ||
          event.key === ' '
        ) {
          if (!context.open) {
            event.preventDefault();
            context.setOpen(true);
          }
        }
      }}
    >
      {children}
    </button>
  );
}

export interface PopoverContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  side?: PopoverSide;
  align?: PopoverAlign;
  sideOffset?: number;
}

export function PopoverContent({
  children,
  side = 'bottom',
  align = 'center',
  sideOffset = 8,
  className,
  style,
  ...props
}: PopoverContentProps) {
  const context = usePopoverContext('PopoverContent');

  if (!context.open) {
    return null;
  }

  return (
    <div
      {...props}
      id={context.contentId}
      role="dialog"
      aria-labelledby={context.triggerId}
      tabIndex={-1}
      data-side={side}
      data-align={align}
      className={['gt-popover__content', className ?? '']
        .filter(Boolean)
        .join(' ')}
      style={
        {
          ...style,
          '--gt-popover-side-offset': `${sideOffset}px`,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
