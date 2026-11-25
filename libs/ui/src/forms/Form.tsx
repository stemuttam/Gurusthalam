import { forwardRef, type FormHTMLAttributes, type ReactNode } from 'react';

import {
  FormValidationProvider,
  type FormValidationErrors,
} from './FormValidationContext.js';

export interface FormProps extends FormHTMLAttributes<HTMLFormElement> {
  children: ReactNode;
  /** Validation errors keyed by field name; use `_form` for form-level errors. */
  validationErrors?: FormValidationErrors;
}

export const Form = forwardRef<HTMLFormElement, FormProps>(function Form(
  { children, className, validationErrors = {}, ...props },
  ref,
) {
  return (
    <FormValidationProvider errors={validationErrors}>
      <form
        {...props}
        ref={ref}
        className={['gt-form', className ?? ''].filter(Boolean).join(' ')}
      >
        {children}
      </form>
    </FormValidationProvider>
  );
});

Form.displayName = 'Form';
