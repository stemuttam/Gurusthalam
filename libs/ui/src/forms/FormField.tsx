import { useId, type HTMLAttributes, type ReactNode } from 'react';

import { FormFieldProvider } from './FormFieldContext.js';

export interface FormFieldProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'children'
> {
  /** Accessible label for the control. */
  label: ReactNode;

  /** Control content, normally Input, Select, or Textarea. */
  children: ReactNode;

  /** Optional stable ID assigned to the control. */
  controlId?: string;

  /** Supporting text displayed below the control. */
  description?: ReactNode;

  /** Validation message displayed below the control. */
  error?: ReactNode;

  /** Marks the control as required and communicates it to supported controls. */
  required?: boolean;

  /** Displays an optional indicator when the field is not required. */
  optional?: boolean;

  /** Disables supported controls within the field. */
  disabled?: boolean;

  /** Explicit invalid state, useful before an error message is available. */
  invalid?: boolean;

  /** Custom class for the label. */
  labelClassName?: string;

  /** Custom class for the description. */
  descriptionClassName?: string;

  /** Custom class for the error message. */
  errorClassName?: string;

  /** Text shown beside an optional field label. */
  optionalLabel?: ReactNode;
}

function hasContent(value: ReactNode): boolean {
  return value !== null && value !== undefined && value !== false;
}

export function FormField({
  label,
  children,
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
  const resolvedControlId = controlId ?? `gt-form-control-${generatedId}`;

  const hasDescription = hasContent(description);
  const hasError = hasContent(error);
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
            role="alert"
          >
            {error}
          </div>
        ) : null}
      </div>
    </FormFieldProvider>
  );
}

FormField.displayName = 'FormField';
