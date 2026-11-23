import { forwardRef, useId, type SelectHTMLAttributes } from 'react';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  errorMessage?: string;
  invalid?: boolean;
  fieldClassName?: string;
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
      required = false,
      disabled = false,
      'aria-describedby': ariaDescribedBy,
      children,
      ...props
    },
    ref,
  ) {
    const generatedId = useId();
    const selectId = providedId ?? generatedId;
    const helperId = `${selectId}-help`;
    const errorId = `${selectId}-error`;

    const describedBy =
      [
        ariaDescribedBy,
        helperText ? helperId : undefined,
        errorMessage ? errorId : undefined,
      ]
        .filter(Boolean)
        .join(' ') || undefined;

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
            {required ? <span aria-hidden="true"> *</span> : null}
          </label>
        ) : null}

        <select
          {...props}
          ref={ref}
          id={selectId}
          className={selectClasses}
          required={required}
          disabled={disabled}
          aria-invalid={invalid || Boolean(errorMessage) || undefined}
          aria-describedby={describedBy}
        >
          {children}
        </select>

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
  },
);

Select.displayName = 'Select';
