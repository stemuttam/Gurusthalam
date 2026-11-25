import type { HTMLAttributes, ReactNode } from 'react';

export type FormActionsAlign = 'start' | 'center' | 'end' | 'stretch';

export type FormActionsJustify = 'start' | 'center' | 'end' | 'between';

export interface FormActionsProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'children'
> {
  children: ReactNode;
  align?: FormActionsAlign;
  justify?: FormActionsJustify;
  stackOnMobile?: boolean;
}

export function FormActions({
  children,
  align = 'center',
  justify = 'end',
  stackOnMobile = true,
  className,
  ...props
}: FormActionsProps) {
  return (
    <div
      {...props}
      className={[
        'gt-form-actions',
        `gt-form-actions--align-${align}`,
        `gt-form-actions--justify-${justify}`,
        stackOnMobile ? 'gt-form-actions--stack-mobile' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}

FormActions.displayName = 'FormActions';
