import { type HTMLAttributes, type ReactNode } from 'react';

export type AlertVariant = 'success' | 'warning' | 'danger' | 'info';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
}

const variantClasses: Record<AlertVariant, string> = {
  success: 'gt-alert--success',
  warning: 'gt-alert--warning',
  danger: 'gt-alert--danger',
  info: 'gt-alert--info',
};

export function Alert({
  variant = 'info',
  title,
  children,
  className,
  role,
  ...props
}: AlertProps) {
  const classes = ['gt-alert', variantClasses[variant], className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <div
      {...props}
      className={classes}
      role={role ?? (variant === 'danger' ? 'alert' : 'status')}
    >
      {title ? <div className="gt-alert__title">{title}</div> : null}

      <div className="gt-alert__content">{children}</div>
    </div>
  );
}
