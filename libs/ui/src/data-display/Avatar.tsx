import { useState, type HTMLAttributes, type ReactNode } from 'react';

export type AvatarSize = 'small' | 'medium' | 'large' | 'xlarge';

export type AvatarShape = 'circle' | 'square';

export interface AvatarProps extends Omit<
  HTMLAttributes<HTMLSpanElement>,
  'children'
> {
  name: string;
  src?: string;
  alt?: string;
  size?: AvatarSize;
  shape?: AvatarShape;
  fallback?: ReactNode;
}

const sizeClasses: Record<AvatarSize, string> = {
  small: 'gt-avatar--small',
  medium: 'gt-avatar--medium',
  large: 'gt-avatar--large',
  xlarge: 'gt-avatar--xlarge',
};

const shapeClasses: Record<AvatarShape, string> = {
  circle: 'gt-avatar--circle',
  square: 'gt-avatar--square',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  const firstPart = parts[0];

  if (!firstPart) {
    return '?';
  }

  if (parts.length === 1) {
    return firstPart.slice(0, 2).toUpperCase();
  }

  const lastPart = parts[parts.length - 1];

  return `${firstPart[0] ?? ''}${lastPart?.[0] ?? ''}`.toUpperCase();
}

export function Avatar({
  name,
  src,
  alt,
  size = 'medium',
  shape = 'circle',
  fallback,
  className,
  ...props
}: AvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const accessibleName =
    alt?.trim().replace(/\s+/g, ' ') ||
    name.trim().replace(/\s+/g, ' ') ||
    'User avatar';

  const showImage = Boolean(src?.trim()) && !imageFailed;

  const classes = [
    'gt-avatar',
    sizeClasses[size],
    shapeClasses[shape],
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span {...props} className={classes} role="img" aria-label={accessibleName}>
      {showImage ? (
        <img
          className="gt-avatar__image"
          src={src}
          alt=""
          aria-hidden="true"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className="gt-avatar__fallback" aria-hidden="true">
          {fallback ?? getInitials(name)}
        </span>
      )}
    </span>
  );
}
