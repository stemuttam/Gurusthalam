import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export type ButtonVariant =
  'primary' | 'secondary' | 'accent' | 'ghost' | 'danger';

export type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'gt-button--primary',
  secondary: 'gt-button--secondary',
  accent: 'gt-button--accent',
  ghost: 'gt-button--ghost',
  danger: 'gt-button--danger',
};

const sizeClasses: Record<ButtonSize, string> = {
  small: 'gt-button--small',
  medium: '',
  large: 'gt-button--large',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'medium',
      fullWidth = false,
      loading = false,
      leadingIcon,
      trailingIcon,
      disabled = false,
      className,
      children,
      type = 'button',
      ...props
    },
    ref,
  ) {
    const classes = [
      'gt-button',
      variantClasses[variant],
      sizeClasses[size],
      fullWidth ? 'gt-button--block' : '',
      className ?? '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        {...props}
        ref={ref}
        type={type}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
      >
        {loading ? (
          <span className="gt-button__loading" aria-hidden="true">
            <span className="gt-spinner gt-spinner--small" />
          </span>
        ) : (
          leadingIcon
        )}

        <span>{children}</span>

        {!loading && trailingIcon}
      </button>
    );
  },
);

Button.displayName = 'Button';
