import { forwardRef, type HTMLAttributes } from 'react';

export type ProgressVariant = 'primary' | 'success' | 'warning' | 'danger';

export type ProgressSize = 'small' | 'medium' | 'large';

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value?: number | null;
  max?: number;
  label?: string;
  valueLabel?: string;
  showValue?: boolean;
  size?: ProgressSize;
  variant?: ProgressVariant;
}

const variantClasses: Record<ProgressVariant, string> = {
  primary: 'gt-progress__bar--primary',
  success: 'gt-progress__bar--success',
  warning: 'gt-progress__bar--warning',
  danger: 'gt-progress__bar--danger',
};

const sizeClasses: Record<ProgressSize, string> = {
  small: 'gt-progress--small',
  medium: 'gt-progress--medium',
  large: 'gt-progress--large',
};

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  function Progress(
    {
      value = 0,
      max = 100,
      label,
      valueLabel,
      showValue = false,
      size = 'medium',
      variant = 'primary',
      className,
      'aria-label': ariaLabel,
      'aria-valuetext': ariaValueText,
      ...props
    },
    ref,
  ) {
    const safeMax = Number.isFinite(max) && max > 0 ? max : 100;

    const isIndeterminate = value === null || value === undefined;

    const safeValue = isIndeterminate
      ? null
      : Number.isFinite(value)
        ? Math.min(Math.max(value, 0), safeMax)
        : 0;

    const percentage = safeValue === null ? null : (safeValue / safeMax) * 100;

    const displayedValue =
      percentage === null ? null : `${Math.round(percentage)}%`;

    const classes = [
      'gt-progress',
      sizeClasses[size],
      isIndeterminate ? 'gt-progress--indeterminate' : '',
      className ?? '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className="gt-progress-wrapper">
        {label || (showValue && displayedValue) ? (
          <div className="gt-progress__header">
            {label ? <span className="gt-progress__label">{label}</span> : null}

            {showValue && displayedValue ? (
              <span className="gt-progress__value">
                {valueLabel ?? displayedValue}
              </span>
            ) : null}
          </div>
        ) : null}

        <div
          {...props}
          ref={ref}
          className={classes}
          role="progressbar"
          aria-label={ariaLabel ?? label ?? 'Progress'}
          aria-valuemin={0}
          aria-valuemax={safeMax}
          aria-valuenow={safeValue ?? undefined}
          aria-valuetext={
            ariaValueText ?? valueLabel ?? displayedValue ?? undefined
          }
        >
          <span
            className={['gt-progress__bar', variantClasses[variant]].join(' ')}
            style={{
              width: percentage === null ? undefined : `${percentage}%`,
            }}
          />
        </div>
      </div>
    );
  },
);

Progress.displayName = 'Progress';
