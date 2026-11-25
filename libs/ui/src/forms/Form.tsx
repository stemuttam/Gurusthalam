import { forwardRef, type FormHTMLAttributes, type ReactNode } from 'react';

export interface FormProps extends FormHTMLAttributes<HTMLFormElement> {
  children: ReactNode;
}

export const Form = forwardRef<HTMLFormElement, FormProps>(function Form(
  { children, className, ...props },
  ref,
) {
  return (
    <form
      {...props}
      ref={ref}
      className={['gt-form', className ?? ''].filter(Boolean).join(' ')}
    >
      {children}
    </form>
  );
});

Form.displayName = 'Form';
