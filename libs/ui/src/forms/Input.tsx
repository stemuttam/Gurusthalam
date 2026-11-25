import { forwardRef, useId, type InputHTMLAttributes } from 'react';

import { useFormFieldContext } from './FormFieldContext.js';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  errorMessage?: string;
  invalid?: boolean;
  fieldClassName?: string;
}

function mergeIds(...values: Array<string | undefined>): string | undefined {
  const ids = [
    ...new Set(values.flatMap((value) => value?.split(/\s+/) ?? [])),
  ].filter(Boolean);

  return ids.length > 0 ? ids.join(' ') : undefined;
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
    required,
    disabled,
    'aria-describedby': ariaDescribedBy,
    'aria-errormessage': ariaErrorMessage,
    'aria-invalid': ariaInvalid,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const formField = useFormFieldContext();

  const inputId = formField?.controlId ?? providedId ?? generatedId;

  const resolvedRequired = required ?? formField?.required ?? false;
  const resolvedDisabled = disabled ?? formField?.disabled ?? false;

  const helperId = `${inputId}-help`;
  const errorId = `${inputId}-error`;

  const describedBy = mergeIds(
    ariaDescribedBy,
    formField?.describedBy,
    helperText ? helperId : undefined,
    errorMessage ? errorId : undefined,
  );

  const resolvedErrorMessage = mergeIds(
    ariaErrorMessage,
    formField?.errorId,
    errorMessage ? errorId : undefined,
  );

  const isAriaInvalid =
    ariaInvalid === true ||
    ariaInvalid === 'true' ||
    ariaInvalid === 'grammar' ||
    ariaInvalid === 'spelling';

  const isInvalid =
    invalid ||
    Boolean(errorMessage) ||
    Boolean(formField?.invalid) ||
    isAriaInvalid;

  const inputClasses = ['gt-input', className ?? ''].filter(Boolean).join(' ');

  const fieldClasses = ['gt-field', fieldClassName ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={fieldClasses}>
      {label ? (
        <label className="gt-label" htmlFor={inputId}>
          {label}
          {resolvedRequired ? <span aria-hidden="true"> *</span> : null}
        </label>
      ) : null}

      <input
        {...props}
        ref={ref}
        id={inputId}
        className={inputClasses}
        required={resolvedRequired}
        disabled={resolvedDisabled}
        aria-invalid={isInvalid || undefined}
        aria-describedby={describedBy}
        aria-errormessage={resolvedErrorMessage}
      />

      {helperText ? (
        <span className="gt-help-text" id={helperId}>
          {helperText}
        </span>
      ) : null}

      {errorMessage ? (
        <span
          className="gt-error-text"
          id={errorId}
          role={formField ? undefined : 'alert'}
        >
          {errorMessage}
        </span>
      ) : null}
    </div>
  );
});

Input.displayName = 'Input';
