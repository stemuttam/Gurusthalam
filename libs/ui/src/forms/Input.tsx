import { forwardRef, useId, type InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  errorMessage?: string;
  invalid?: boolean;
  fieldClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    helperText,
    errorMessage,
    invalid = false,
    fieldClassName,
    className,
    id: providedId,
    required = false,
    disabled = false,
    'aria-describedby': ariaDescribedBy,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const inputId = providedId ?? generatedId;
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

  const inputClasses = ['gt-input', className ?? ''].filter(Boolean).join(' ');

  const fieldClasses = ['gt-field', fieldClassName ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={fieldClasses}>
      {label ? (
        <label className="gt-label" htmlFor={inputId}>
          {label}
          {required ? <span aria-hidden="true"> *</span> : null}
        </label>
      ) : null}

      <input
        {...props}
        ref={ref}
        id={inputId}
        className={inputClasses}
        required={required}
        disabled={disabled}
        aria-invalid={invalid || Boolean(errorMessage) || undefined}
        aria-describedby={describedBy}
      />

      {helperText ? (
        <span className="gt-help-text" id={helperId}>
          {helperText}
        </span>
      ) : null}

      {errorMessage ? (
        <span className="gt-error-text" id={errorId}>
          {errorMessage}
        </span>
      ) : null}
    </div>
  );
});

Input.displayName = 'Input';
