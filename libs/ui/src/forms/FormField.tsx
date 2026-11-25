import { useId, type HTMLAttributes, type ReactNode } from 'react';

import { FormFieldProvider } from './FormFieldContext.js';
import { useFormValidationErrors } from './FormValidationContext.js';
import type { FormErrorValue } from './FormValidationContext.js';

export interface FormFieldProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'children'
> {
  /** Accessible label for the control. */
  label: ReactNode;
  /** Control content, normally Input, Select, or Textarea. */
  children: ReactNode;
  /** Name used to associate the field with Form validation errors. */
  name?: string;
  /** Optional stable ID assigned to the control. */
  controlId?: string;
  /** Supporting text displayed below the control. */
  description?: ReactNode;
  /** Explicit validation message; takes precedence over Form validation errors. */
  error?: ReactNode;
  required?: boolean;
  optional?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  labelClassName?: string;
  descriptionClassName?: string;
  errorClassName?: string;
  optionalLabel?: ReactNode;
}

function hasContent(value: ReactNode): boolean {
  return value !== null && value !== undefined && value !== false;
}

function toErrorContent(value: FormErrorValue | undefined): ReactNode {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value.length === 0) {
    return undefined;
  }

  if (value.length === 1) {
    return value[0];
  }

  return (
    <ul className="gt-form-field__error-list">
      {value.map((message, index) => (
        <li key={`${index}-${message}`}>{message}</li>
      ))}
    </ul>
  );
}

export function FormField({
  label,
  children,
  name,
  controlId,
  description,
  error,
  required = false,
  optional = false,
  disabled = false,
  invalid = false,
  className,
  labelClassName,
  descriptionClassName,
  errorClassName,
  optionalLabel = 'Optional',
  ...props
}: FormFieldProps) {
  const generatedId = useId();
  const validationErrors = useFormValidationErrors();

  const resolvedControlId =
    controlId ?? name ?? `gt-form-control-${generatedId}`;

  const mappedError =
    name && Object.prototype.hasOwnProperty.call(validationErrors, name)
      ? toErrorContent(validationErrors[name])
      : undefined;
  const resolvedError = error ?? mappedError;

  const hasDescription = hasContent(description);
  const hasError = hasContent(resolvedError);
  const isInvalid = invalid || hasError;

  const descriptionId = hasDescription
    ? `${resolvedControlId}-form-description`
    : undefined;

  const errorId = hasError ? `${resolvedControlId}-form-error` : undefined;

  const describedBy =
    [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <FormFieldProvider
      value={{
        controlId: resolvedControlId,
        ...(describedBy !== undefined ? { describedBy } : {}),
        ...(errorId !== undefined ? { errorId } : {}),
        required,
        disabled,
        invalid: isInvalid,
      }}
    >
      <div
        {...props}
        className={['gt-form-field', className ?? ''].filter(Boolean).join(' ')}
        data-field-name={name}
        data-invalid={isInvalid ? 'true' : undefined}
        data-disabled={disabled ? 'true' : undefined}
      >
        <label
          className={['gt-label', 'gt-form-field__label', labelClassName ?? '']
            .filter(Boolean)
            .join(' ')}
          htmlFor={resolvedControlId}
        >
          <span>{label}</span>

          {required ? (
            <span className="gt-form-field__required" aria-hidden="true">
              {' *'}
            </span>
          ) : null}

          {!required && optional ? (
            <span className="gt-form-field__optional">{optionalLabel}</span>
          ) : null}
        </label>

        <div className="gt-form-field__control">{children}</div>

        {hasDescription ? (
          <div
            id={descriptionId}
            className={[
              'gt-help-text',
              'gt-form-field__description',
              descriptionClassName ?? '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {description}
          </div>
        ) : null}

        {hasError ? (
          <div
            id={errorId}
            className={[
              'gt-error-text',
              'gt-form-field__error',
              errorClassName ?? '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {resolvedError}
          </div>
        ) : null}
      </div>
    </FormFieldProvider>
  );
}

FormField.displayName = 'FormField';
