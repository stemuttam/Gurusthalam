import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  label: ReactNode;
  helperText?: ReactNode;
  errorMessage?: ReactNode;
  className?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox(
    {
      id,
      label,
      helperText,
      errorMessage,
      className,
      disabled,
      required,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
      ...inputProps
    },
    ref,
  ) {
    const generatedId = useId();
    const inputId = id ?? `gt-checkbox-${generatedId}`;
    const helperId = `${inputId}-help`;
    const errorId = `${inputId}-error`;

    const describedBy =
      [
        ariaDescribedBy,
        helperText ? helperId : undefined,
        errorMessage ? errorId : undefined,
      ]
        .filter(Boolean)
        .join(' ') || undefined;

    return (
      <div className="gt-selection-field">
        <label
          className={[
            'gt-checkbox',
            disabled ? 'gt-checkbox--disabled' : '',
            className ?? '',
          ]
            .filter(Boolean)
            .join(' ')}
          htmlFor={inputId}
        >
          <input
            {...inputProps}
            ref={ref}
            id={inputId}
            type="checkbox"
            className="gt-checkbox__input"
            disabled={disabled}
            required={required}
            aria-describedby={describedBy}
            aria-invalid={errorMessage ? true : ariaInvalid}
          />

          <span className="gt-checkbox__label">{label}</span>
        </label>

        {helperText && (
          <span id={helperId} className="gt-help-text">
            {helperText}
          </span>
        )}

        {errorMessage && (
          <span id={errorId} className="gt-error-text" role="alert">
            {errorMessage}
          </span>
        )}
      </div>
    );
  },
);

Checkbox.displayName = 'Checkbox';
