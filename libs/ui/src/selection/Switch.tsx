import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

export interface SwitchProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  label: ReactNode;
  description?: ReactNode;
  className?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  {
    id,
    label,
    description,
    className,
    disabled,
    required,
    'aria-describedby': ariaDescribedBy,
    ...inputProps
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? `gt-switch-${generatedId}`;
  const descriptionId = `${inputId}-description`;

  const describedBy =
    [ariaDescribedBy, description ? descriptionId : undefined]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div
      className={['gt-selection-field', 'gt-switch-field', className ?? '']
        .filter(Boolean)
        .join(' ')}
    >
      <label
        className={['gt-switch', disabled ? 'gt-switch--disabled' : '']
          .filter(Boolean)
          .join(' ')}
        htmlFor={inputId}
      >
        <input
          {...inputProps}
          ref={ref}
          id={inputId}
          type="checkbox"
          role="switch"
          className="gt-switch__input"
          disabled={disabled}
          required={required}
          aria-describedby={describedBy}
        />
        <span className="gt-switch__track" aria-hidden="true">
          <span className="gt-switch__thumb" />
        </span>
        <span className="gt-switch__content">
          <span className="gt-switch__label">{label}</span>
          {description && (
            <span id={descriptionId} className="gt-help-text">
              {description}
            </span>
          )}
        </span>
      </label>
    </div>
  );
});

Switch.displayName = 'Switch';
