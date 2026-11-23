import { type HTMLAttributes, type ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  interactive?: boolean;
}

export function Card({
  children,
  interactive = false,
  className,
  ...props
}: CardProps) {
  const classes = [
    'gt-card',
    interactive ? 'gt-card--interactive' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div {...props} className={classes}>
      {children}
    </div>
  );
}

export interface StatCardProps {
  label: string;
  value: ReactNode;
  description?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  description,
  className,
}: StatCardProps) {
  return (
    <Card className={className}>
      <div className="gt-stat-card">
        <p className="gt-stat-card__label">{label}</p>

        <div className="gt-stat-card__value">{value}</div>

        {description ? (
          <p className="gt-stat-card__description">{description}</p>
        ) : null}
      </div>
    </Card>
  );
}
