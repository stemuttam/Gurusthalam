import { createContext, useContext, type ReactNode } from 'react';

export type FormErrorValue = string | readonly string[];

export type FormValidationErrors = Readonly<
  Record<string, FormErrorValue | undefined>
>;

const FormValidationContext = createContext<FormValidationErrors>({});

export function FormValidationProvider({
  errors,
  children,
}: {
  errors: FormValidationErrors;
  children: ReactNode;
}) {
  return (
    <FormValidationContext.Provider value={errors}>
      {children}
    </FormValidationContext.Provider>
  );
}

export function useFormValidationErrors(): FormValidationErrors {
  return useContext(FormValidationContext);
}
