import { forwardRef, useId, type SelectHTMLAttributes } from 'react';

import { useFormFieldContext } from './FormFieldContext.js';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
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

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
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
      'aria-invalid': ariaInvalid,
      children,
      ...props
    },
    ref,
  ) {
    const generatedId = useId();
    const formField = useFormFieldContext();

    const selectId = formField?.controlId ?? providedId ?? generatedId;

    const resolvedRequired = required ?? formField?.required ?? false;
    const resolvedDisabled = disabled ?? formField?.disabled ?? false;

    const helperId = `${selectId}-help`;
    const errorId = `${selectId}-error`;

    const describedBy = mergeIds(
      ariaDescribedBy,
      formField?.describedBy,
      helperText ? helperId : undefined,
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

    const selectClasses = ['gt-select', className ?? '']
      .filter(Boolean)
      .join(' ');

    const fieldClasses = ['gt-field', fieldClassName ?? '']
      .filter(Boolean)
      .join(' ');

    return (
      <div className={fieldClasses}>
        {label ? (
          <label className="gt-label" htmlFor={selectId}>
            {label}
            {resolvedRequired ? <span aria-hidden="true"> *</span> : null}
          </label>
        ) : null}

        <select
          {...props}
          ref={ref}
          id={selectId}
          className={selectClasses}
          required={resolvedRequired}
          disabled={resolvedDisabled}
          aria-invalid={isInvalid || undefined}
          aria-describedby={describedBy}
          aria-errormessage={formField?.errorId}
        >
          {children}
        </select>

        {helperText ? (
          <span className="gt-help-text" id={helperId}>
            {helperText}
          </span>
        ) : null}

        {errorMessage ? (
          <span className="gt-error-text" id={errorId} role="alert">
            {errorMessage}
          </span>
        ) : null}
      </div>
    );
  },
);

Select.displayName = 'Select';
