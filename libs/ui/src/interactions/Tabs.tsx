import {
  createContext,
  useContext,
  useId,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

export type TabsOrientation = 'horizontal' | 'vertical';
export type TabsActivationMode = 'automatic' | 'manual';

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
  baseId: string;
  orientation: TabsOrientation;
  activationMode: TabsActivationMode;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(componentName: string): TabsContextValue {
  const context = useContext(TabsContext);

  if (!context) {
    throw new Error(`${componentName} must be used inside Tabs.`);
  }

  return context;
}

export interface TabsProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'defaultValue' | 'onChange'
> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: TabsOrientation;
  activationMode?: TabsActivationMode;
  children: ReactNode;
}

export function Tabs({
  value: controlledValue,
  defaultValue = '',
  onValueChange,
  orientation = 'horizontal',
  activationMode = 'automatic',
  children,
  className,
  ...props
}: TabsProps) {
  const baseId = useId();
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);

  const value = controlledValue ?? uncontrolledValue;

  function setValue(nextValue: string) {
    if (controlledValue === undefined) {
      setUncontrolledValue(nextValue);
    }

    onValueChange?.(nextValue);
  }

  const context: TabsContextValue = {
    value,
    setValue,
    baseId,
    orientation,
    activationMode,
  };

  const classes = [
    'gt-tabs',
    `gt-tabs--${orientation}`,
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <TabsContext.Provider value={context}>
      <div {...props} className={classes} data-orientation={orientation}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  label?: string;
}

export function TabsList({
  children,
  label = 'Tabs',
  className,
  onKeyDown,
  ...props
}: TabsListProps) {
  const { orientation, activationMode, setValue } =
    useTabsContext('TabsList');

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    const keys =
      orientation === 'horizontal'
        ? ['ArrowLeft', 'ArrowRight']
        : ['ArrowUp', 'ArrowDown'];

    if (
      !keys.includes(event.key) &&
      event.key !== 'Home' &&
      event.key !== 'End'
    ) {
      return;
    }

    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[role="tab"]:not(:disabled)',
      ),
    );

    if (tabs.length === 0) return;

    const currentIndex = tabs.indexOf(
      document.activeElement as HTMLButtonElement,
    );

    let nextIndex = currentIndex;

    if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = tabs.length - 1;
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1 + tabs.length) % tabs.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    }

    const nextTab = tabs[nextIndex];
    if (!nextTab) return;

    event.preventDefault();
    nextTab.focus();

    if (activationMode === 'automatic') {
      const nextValue = nextTab.dataset.value;
      if (nextValue) setValue(nextValue);
    }
  }

  const classes = ['gt-tabs__list', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <div
      {...props}
      className={classes}
      role="tablist"
      aria-label={label}
      aria-orientation={orientation}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}

export interface TabsTriggerProps extends Omit<
  HTMLAttributes<HTMLButtonElement>,
  'value'
> {
  value: string;
  children: ReactNode;
  disabled?: boolean;
}

export function TabsTrigger({
  value,
  children,
  disabled = false,
  className,
  onClick,
  ...props
}: TabsTriggerProps) {
  const context = useTabsContext('TabsTrigger');
  const selected = context.value === value;
  const triggerId = `${context.baseId}-tab-${value}`;
  const panelId = `${context.baseId}-panel-${value}`;

  const classes = [
    'gt-tabs__trigger',
    selected ? 'gt-tabs__trigger--active' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      {...props}
      id={triggerId}
      type="button"
      role="tab"
      className={classes}
      data-value={value}
      aria-selected={selected}
      aria-controls={panelId}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && !disabled) {
          context.setValue(value);
        }
      }}
    >
      {children}
    </button>
  );
}

export interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  children: ReactNode;
  forceMount?: boolean;
}

export function TabsContent({
  value,
  children,
  forceMount = false,
  className,
  ...props
}: TabsContentProps) {
  const context = useTabsContext('TabsContent');
  const selected = context.value === value;

  if (!selected && !forceMount) return null;

  const classes = ['gt-tabs__content', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <div
      {...props}
      id={`${context.baseId}-panel-${value}`}
      className={classes}
      role="tabpanel"
      aria-labelledby={`${context.baseId}-tab-${value}`}
      hidden={!selected}
      tabIndex={0}
    >
      {children}
    </div>
  );
}