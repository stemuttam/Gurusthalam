import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

export type ToastVariant = 'success' | 'warning' | 'error' | 'info';

export interface ToastProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'title'
> {
  variant?: ToastVariant;
  title?: ReactNode;
  description?: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
}

const variantClasses: Record<ToastVariant, string> = {
  success: 'gt-toast--success',
  warning: 'gt-toast--warning',
  error: 'gt-toast--error',
  info: 'gt-toast--info',
};

export const Toast = forwardRef<HTMLDivElement, ToastProps>(function Toast(
  {
    variant = 'info',
    title,
    description,
    children,
    onDismiss,
    dismissLabel = 'Dismiss notification',
    className,
    role,
    ...props
  },
  ref,
) {
  const classes = ['gt-toast', variantClasses[variant], className ?? '']
    .filter(Boolean)
    .join(' ');

  const content = description ?? children;

  return (
    <div
      {...props}
      ref={ref}
      className={classes}
      role={role ?? (variant === 'error' ? 'alert' : 'status')}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
    >
      <span className="gt-toast__indicator" aria-hidden="true" />

      <div className="gt-toast__body">
        {title ? <div className="gt-toast__title">{title}</div> : null}

        {content ? (
          <div className="gt-toast__description">{content}</div>
        ) : null}
      </div>

      {onDismiss ? (
        <button
          type="button"
          className="gt-toast__dismiss"
          aria-label={dismissLabel}
          onClick={onDismiss}
        >
          <span aria-hidden="true">×</span>
        </button>
      ) : null}
    </div>
  );
});

Toast.displayName = 'Toast';
