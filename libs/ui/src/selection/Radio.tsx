import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

export interface RadioProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  label: ReactNode;
  className?: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { id, label, className, disabled, ...inputProps },
  ref,
) {
  return (
    <label
      className={[
        'gt-radio',
        disabled ? 'gt-radio--disabled' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      htmlFor={id}
    >
      <input
        {...inputProps}
        ref={ref}
        id={id}
        type="radio"
        className="gt-radio__input"
        disabled={disabled}
      />
      <span className="gt-radio__label">{label}</span>
    </label>
  );
});

Radio.displayName = 'Radio';
