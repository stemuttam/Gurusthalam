import { type HTMLAttributes, type ReactNode } from 'react';

export type BadgeVariant =
  'neutral' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  neutral: '',
  success: 'gt-badge--success',
  warning: 'gt-badge--warning',
  danger: 'gt-badge--danger',
  info: 'gt-badge--info',
};

export function Badge({
  variant = 'neutral',
  children,
  className,
  ...props
}: BadgeProps) {
  const classes = ['gt-badge', variantClasses[variant], className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <span {...props} className={classes}>
      {children}
    </span>
  );
}
