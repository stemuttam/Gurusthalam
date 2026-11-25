import { useEffect, useId, useRef, type HTMLAttributes } from 'react';

import { FORM_LEVEL_ERROR_KEY } from './validation.js';
import {
  useFormValidationErrors,
  type FormValidationErrors,
} from './FormValidationContext.js';

export interface FormErrorSummaryProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'title'
> {
  /** Optional explicit errors; otherwise errors are inherited from Form. */
  errors?: FormValidationErrors;
  title?: string;
  description?: string;
  /** Focus the summary after it mounts, for example after invalid submission. */
  focusOnMount?: boolean;
  /**
   * Maps validation field names to actual control IDs.
   * Useful when FormField uses a custom controlId.
   */
  fieldIds?: Readonly<Record<string, string>>;
}

function toMessages(value: string | readonly string[]): string[] {
  const values = typeof value === 'string' ? [value] : [...value];

  return [...new Set(values.map((message) => message.trim()).filter(Boolean))];
}

export function FormErrorSummary({
  errors,
  title = 'There are problems with your submission',
  description,
  focusOnMount = false,
  fieldIds,
  className,
  ...props
}: FormErrorSummaryProps) {
  const inheritedErrors = useFormValidationErrors();
  const resolvedErrors = errors ?? inheritedErrors;

  const headingId = useId();
  const descriptionId = useId();
  const summaryRef = useRef<HTMLDivElement>(null);

  const entries = Object.entries(resolvedErrors)
    .filter((entry): entry is [string, string | readonly string[]] => {
      return entry[1] !== undefined;
    })
    .map(([name, value]) => ({
      name,
      messages: toMessages(value),
      controlId: fieldIds?.[name] ?? name,
    }))
    .filter((entry) => entry.messages.length > 0);

  const hasErrors = entries.length > 0;

  useEffect(() => {
    if (focusOnMount && hasErrors) {
      summaryRef.current?.focus();
    }
  }, [focusOnMount, hasErrors]);

  if (!hasErrors) {
    return null;
  }

  return (
    <div
      {...props}
      ref={summaryRef}
      className={['gt-form-error-summary', className ?? '']
        .filter(Boolean)
        .join(' ')}
      role="alert"
      aria-labelledby={headingId}
      aria-describedby={description ? descriptionId : undefined}
      tabIndex={-1}
    >
      <h2 id={headingId} className="gt-form-error-summary__title">
        {title}
      </h2>

      {description ? (
        <p id={descriptionId} className="gt-form-error-summary__description">
          {description}
        </p>
      ) : null}

      <ul className="gt-form-error-summary__list">
        {entries.map(({ name, messages, controlId }) => (
          <li key={name} className="gt-form-error-summary__item">
            {name === FORM_LEVEL_ERROR_KEY ? (
              <span>{messages.join(' ')}</span>
            ) : (
              <a
                className="gt-form-error-summary__link"
                href={`#${encodeURIComponent(controlId)}`}
              >
                {messages.join(' ')}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

FormErrorSummary.displayName = 'FormErrorSummary';
