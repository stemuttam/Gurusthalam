import {
  cloneElement,
  useId,
  useState,
  type HTMLAttributes,
  type ReactElement,
} from 'react';

export type TooltipPlacement = 'top' | 'right' | 'bottom' | 'left';

type TooltipChildProps = {
  'aria-describedby'?: string;
  onBlur?: React.FocusEventHandler;
  onFocus?: React.FocusEventHandler;
  onMouseEnter?: React.MouseEventHandler;
  onMouseLeave?: React.MouseEventHandler;
};

export interface TooltipProps extends Omit<
  HTMLAttributes<HTMLSpanElement>,
  'content'
> {
  content: string;
  children: ReactElement<TooltipChildProps>;
  placement?: TooltipPlacement;
  disabled?: boolean;
}

export function Tooltip({
  content,
  children,
  placement = 'top',
  disabled = false,
  className,
  onKeyDown,
  ...props
}: TooltipProps) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);

  const existingDescription = children.props['aria-describedby'];

  const describedBy = open
    ? [existingDescription, tooltipId].filter(Boolean).join(' ')
    : existingDescription;

  const child = cloneElement(children, {
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
    onFocus: (event) => {
      children.props.onFocus?.(event);

      if (!disabled) {
        setOpen(true);
      }
    },
    onBlur: (event) => {
      children.props.onBlur?.(event);
      setOpen(false);
    },
    onMouseEnter: (event) => {
      children.props.onMouseEnter?.(event);

      if (!disabled) {
        setOpen(true);
      }
    },
    onMouseLeave: (event) => {
      children.props.onMouseLeave?.(event);
      setOpen(false);
    },
  });

  return (
    <span
      {...props}
      className={['gt-tooltip', className ?? ''].filter(Boolean).join(' ')}
      onKeyDown={(event) => {
        onKeyDown?.(event);

        if (event.defaultPrevented) {
          return;
        }

        if (event.key === 'Escape') {
          setOpen(false);
        }
      }}
    >
      {child}

      {open && !disabled ? (
        <span
          id={tooltipId}
          role="tooltip"
          className="gt-tooltip__content"
          data-placement={placement}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
