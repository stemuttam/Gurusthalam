import { useId, type HTMLAttributes, type ReactNode } from 'react';

export interface EmptyStateProps extends Omit<
  HTMLAttributes<HTMLElement>,
  'title'
> {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
  ...props
}: EmptyStateProps) {
  const generatedId = useId();
  const titleId = `gt-empty-state-${generatedId}`;

  const classes = ['gt-empty-state', className ?? ''].filter(Boolean).join(' ');

  return (
    <section {...props} className={classes} aria-labelledby={titleId}>
      {icon ? (
        <div className="gt-empty-state__icon" aria-hidden="true">
          {icon}
        </div>
      ) : null}

      <div className="gt-empty-state__content">
        <h2 id={titleId} className="gt-empty-state__title">
          {title}
        </h2>

        {description ? (
          <div className="gt-empty-state__description">{description}</div>
        ) : null}
      </div>

      {action ? <div className="gt-empty-state__action">{action}</div> : null}
    </section>
  );
}
