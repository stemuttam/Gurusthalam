import { useId, type FieldsetHTMLAttributes, type ReactNode } from 'react';

export interface FormSectionProps extends Omit<
  FieldsetHTMLAttributes<HTMLFieldSetElement>,
  'children'
> {
  /** Accessible section heading rendered as a legend. */
  legend: ReactNode;

  /** Optional explanation associated with the fieldset. */
  description?: ReactNode;

  /** Section content, normally FormField components. */
  children: ReactNode;

  /** Custom class for the legend. */
  legendClassName?: string;

  /** Custom class for the description. */
  descriptionClassName?: string;
}

export function FormSection({
  legend,
  description,
  children,
  className,
  legendClassName,
  descriptionClassName,
  disabled,
  'aria-describedby': ariaDescribedBy,
  ...props
}: FormSectionProps) {
  const generatedId = useId();
  const descriptionId = description
    ? `gt-form-section-${generatedId}-description`
    : undefined;

  const describedBy =
    [ariaDescribedBy, descriptionId].filter(Boolean).join(' ') || undefined;

  return (
    <fieldset
      {...props}
      disabled={disabled}
      aria-describedby={describedBy}
      className={['gt-form-section', className ?? ''].filter(Boolean).join(' ')}
    >
      <legend
        className={['gt-form-section__legend', legendClassName ?? '']
          .filter(Boolean)
          .join(' ')}
      >
        {legend}
      </legend>

      {description ? (
        <p
          id={descriptionId}
          className={[
            'gt-help-text',
            'gt-form-section__description',
            descriptionClassName ?? '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {description}
        </p>
      ) : null}

      <div className="gt-form-section__content">{children}</div>
    </fieldset>
  );
}

FormSection.displayName = 'FormSection';
