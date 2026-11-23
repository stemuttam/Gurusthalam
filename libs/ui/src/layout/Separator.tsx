import { type HTMLAttributes } from 'react';

export type SeparatorOrientation = 'horizontal' | 'vertical';

export interface SeparatorProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'role' | 'aria-orientation' | 'aria-hidden'
> {
  /**
   * Controls the visual direction of the separator.
   *
   * @default horizontal
   */
  orientation?: SeparatorOrientation;

  /**
   * When true, the separator is hidden from assistive technology.
   *
   * Use false when the separator represents a meaningful boundary
   * between sections of content.
   *
   * @default true
   */
  decorative?: boolean;
}

export function Separator({
  orientation = 'horizontal',
  decorative = true,
  className,
  ...props
}: SeparatorProps) {
  const classes = [
    'gt-separator',
    `gt-separator--${orientation}`,
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      {...props}
      className={classes}
      role={decorative ? undefined : 'separator'}
      aria-hidden={decorative ? true : undefined}
      aria-orientation={decorative ? undefined : orientation}
      data-orientation={orientation}
    />
  );
}
