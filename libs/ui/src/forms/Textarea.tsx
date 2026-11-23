import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  errorMessage?: string;
  invalid?: boolean;
  fieldClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
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
    const textareaId = providedId ?? generatedId;
    const helperId = `${textareaId}-help`;
    const errorId = `${textareaId}-error`;

    const describedBy =
      [
        ariaDescribedBy,
        helperText ? helperId : undefined,
        errorMessage ? errorId : undefined,
      ]
        .filter(Boolean)
        .join(' ') || undefined;

    const textareaClasses = ['gt-textarea', className ?? '']
      .filter(Boolean)
      .join(' ');

    const fieldClasses = ['gt-field', fieldClassName ?? '']
      .filter(Boolean)
      .join(' ');

    return (
      <div className={fieldClasses}>
        {label ? (
          <label className="gt-label" htmlFor={textareaId}>
            {label}
            {required ? <span aria-hidden="true"> *</span> : null}
          </label>
        ) : null}

        <textarea
          {...props}
          ref={ref}
          id={textareaId}
          className={textareaClasses}
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
  },
);

Textarea.displayName = 'Textarea';
