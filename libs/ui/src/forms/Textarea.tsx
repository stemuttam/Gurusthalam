import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';

import { useFormFieldContext } from './FormFieldContext.js';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
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
      required,
      disabled,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
      ...props
    },
    ref,
  ) {
    const generatedId = useId();
    const formField = useFormFieldContext();

    const textareaId = formField?.controlId ?? providedId ?? generatedId;

    const resolvedRequired = required ?? formField?.required ?? false;
    const resolvedDisabled = disabled ?? formField?.disabled ?? false;

    const helperId = `${textareaId}-help`;
    const errorId = `${textareaId}-error`;

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
            {resolvedRequired ? <span aria-hidden="true"> *</span> : null}
          </label>
        ) : null}

        <textarea
          {...props}
          ref={ref}
          id={textareaId}
          className={textareaClasses}
          required={resolvedRequired}
          disabled={resolvedDisabled}
          aria-invalid={isInvalid || undefined}
          aria-describedby={describedBy}
          aria-errormessage={formField?.errorId}
        />

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

Textarea.displayName = 'Textarea';
