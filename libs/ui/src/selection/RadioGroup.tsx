import { useId, useState, type ReactNode } from 'react';

import { Radio } from './Radio.js';

export interface RadioOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps {
  options: readonly RadioOption[];
  label: ReactNode;
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  helperText?: ReactNode;
  errorMessage?: ReactNode;
  disabled?: boolean;
  required?: boolean;
  orientation?: 'vertical' | 'horizontal';
  className?: string;
}

export function RadioGroup({
  options,
  label,
  name,
  value,
  defaultValue,
  onValueChange,
  helperText,
  errorMessage,
  disabled = false,
  required = false,
  orientation = 'vertical',
  className,
}: RadioGroupProps) {
  const generatedId = useId();
  const groupName = name ?? `gt-radio-group-${generatedId}`;
  const helperId = `${generatedId}-help`;
  const errorId = `${generatedId}-error`;

  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const isControlled = value !== undefined;
  const selectedValue = isControlled ? value : internalValue;

  const describedBy =
    [helperText ? helperId : undefined, errorMessage ? errorId : undefined]
      .filter(Boolean)
      .join(' ') || undefined;

  function handleValueChange(nextValue: string) {
    if (!isControlled) {
      setInternalValue(nextValue);
    }

    onValueChange?.(nextValue);
  }

  return (
    <fieldset
      className={[
        'gt-selection-field',
        'gt-radio-group',
        `gt-radio-group--${orientation}`,
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled}
      aria-describedby={describedBy}
      aria-invalid={errorMessage ? true : undefined}
    >
      <legend className="gt-label">
        {label}
        {required && (
          <span className="gt-radio-group__required" aria-hidden="true">
            {' *'}
          </span>
        )}
      </legend>

      <div className="gt-radio-group__options">
        {options.map((option, index) => {
          const optionId = `${generatedId}-option-${index}`;

          return (
            <Radio
              key={option.value}
              id={optionId}
              name={groupName}
              value={option.value}
              label={option.label}
              checked={selectedValue === option.value}
              disabled={disabled || option.disabled}
              required={required}
              onChange={() => handleValueChange(option.value)}
            />
          );
        })}
      </div>

      {helperText && (
        <span id={helperId} className="gt-help-text">
          {helperText}
        </span>
      )}

      {errorMessage && (
        <span id={errorId} className="gt-error-text" role="alert">
          {errorMessage}
        </span>
      )}
    </fieldset>
  );
}
