import { type CSSProperties, type HTMLAttributes } from 'react';

export type SkeletonVariant = 'text' | 'circular' | 'rectangular';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  animated?: boolean;
}

const variantClasses: Record<SkeletonVariant, string> = {
  text: 'gt-skeleton--text',
  circular: 'gt-skeleton--circular',
  rectangular: 'gt-skeleton--rectangular',
};

export function Skeleton({
  variant = 'text',
  width,
  height,
  animated = true,
  className,
  style,
  ...props
}: SkeletonProps) {
  const classes = [
    'gt-skeleton',
    variantClasses[variant],
    animated ? 'gt-skeleton--animated' : 'gt-skeleton--static',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const dimensions: CSSProperties = {
    width,
    height,
  };

  return (
    <div
      {...props}
      className={classes}
      style={{
        ...dimensions,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}
