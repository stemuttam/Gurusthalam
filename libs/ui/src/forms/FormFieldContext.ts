import { createContext, useContext } from 'react';

export interface FormFieldContextValue {
  controlId: string;
  describedBy?: string;
  errorId?: string;
  required: boolean;
  disabled: boolean;
  invalid: boolean;
}

const FormFieldContext = createContext<FormFieldContextValue | null>(null);

/**
 * Internal context used by form controls to inherit their FormField contract.
 */
export function useFormFieldContext(): FormFieldContextValue | null {
  return useContext(FormFieldContext);
}

export const FormFieldProvider = FormFieldContext.Provider;
