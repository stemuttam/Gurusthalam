import { useState, type HTMLAttributes, type ReactNode } from 'react';

export type AvatarSize = 'small' | 'medium' | 'large' | 'xlarge';

export type AvatarShape = 'circle' | 'square';

export interface AvatarProps extends Omit<
  HTMLAttributes<HTMLSpanElement>,
  'children'
> {
  /** Name used to generate initials and provide an accessible name. */
  name: string;
  /** Optional image URL. If loading fails, the initials fallback is rendered. */
  src?: string;
  /** Accessible name override for the avatar. */
  alt?: string;
  /** Visual size of the avatar. */
  size?: AvatarSize;
  /** Visual shape of the avatar. */
  shape?: AvatarShape;
  /** Custom fallback rendered when no usable image is available. */
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

interface ImageState {
  src: string | undefined;
  failed: boolean;
}

function normalizeAccessibleText(value: string | undefined): string {
  return value?.trim().replace(/\s+/g, ' ') ?? '';
}

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
  /*
   * Keep the failed state associated with the source that failed.
   *
   * This avoids stale failure state when a user changes profile images:
   * a newly supplied source is immediately eligible to render without
   * requiring an effect or an additional render cycle.
   */
  const [imageState, setImageState] = useState<ImageState>(() => ({
    src,
    failed: false,
  }));

  const normalizedName = normalizeAccessibleText(name);
  const normalizedAlt = normalizeAccessibleText(alt);

  const accessibleName = normalizedAlt || normalizedName || 'User avatar';

  const normalizedSrc = src?.trim() ?? '';
  const imageFailed = imageState.src === src && imageState.failed;

  const showImage = normalizedSrc.length > 0 && !imageFailed;

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
          src={normalizedSrc}
          alt=""
          aria-hidden="true"
          onError={() => {
            setImageState({
              src,
              failed: true,
            });
          }}
        />
      ) : (
        <span className="gt-avatar__fallback" aria-hidden="true">
          {fallback ?? getInitials(normalizedName)}
        </span>
      )}
    </span>
  );
}
