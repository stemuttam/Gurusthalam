import type { HTMLAttributes, ReactNode } from 'react';

export type ListVariant = 'default' | 'unstyled' | 'divided';

export type ListSize = 'small' | 'medium' | 'large';

export interface ListProps extends HTMLAttributes<HTMLUListElement> {
  /** Render an ordered list instead of an unordered list. */
  ordered?: boolean;
  /** Visual treatment applied to the list. */
  variant?: ListVariant;
  /** Vertical spacing and typography scale. */
  size?: ListSize;
  /** List content, normally ListItem components. */
  children: ReactNode;
}

export interface ListItemProps extends HTMLAttributes<HTMLLIElement> {
  /** Optional content displayed before the main item content. */
  leading?: ReactNode;
  /** Optional supporting description displayed below the main content. */
  description?: ReactNode;
  /** Optional content displayed after the main item content. */
  trailing?: ReactNode;
  /** Main list item content. */
  children: ReactNode;
}

const variantClasses: Record<ListVariant, string> = {
  default: '',
  unstyled: 'gt-list--unstyled',
  divided: 'gt-list--divided',
};

const sizeClasses: Record<ListSize, string> = {
  small: 'gt-list--small',
  medium: 'gt-list--medium',
  large: 'gt-list--large',
};

function joinClasses(...classes: Array<string | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Semantic list primitive.
 *
 * Use ListItem for each direct child to preserve list semantics and
 * consistent item layout.
 */
export function List({
  ordered = false,
  variant = 'default',
  size = 'medium',
  children,
  className,
  ...props
}: ListProps) {
  const classes = joinClasses(
    'gt-list',
    variantClasses[variant],
    sizeClasses[size],
    className,
  );

  if (ordered) {
    return (
      <ol {...props} className={classes}>
        {children}
      </ol>
    );
  }

  return (
    <ul {...props} className={classes}>
      {children}
    </ul>
  );
}

/**
 * Semantic list item with optional leading, supporting, and trailing content.
 */
export function ListItem({
  leading,
  description,
  trailing,
  children,
  className,
  ...props
}: ListItemProps) {
  const hasSupplementaryContent =
    leading !== undefined ||
    description !== undefined ||
    trailing !== undefined;

  if (!hasSupplementaryContent) {
    return (
      <li {...props} className={joinClasses('gt-list__item', className)}>
        {children}
      </li>
    );
  }

  return (
    <li
      {...props}
      className={joinClasses(
        'gt-list__item',
        'gt-list__item--composed',
        className,
      )}
    >
      {leading !== undefined ? (
        <span className="gt-list__leading" aria-hidden="true">
          {leading}
        </span>
      ) : null}

      <span className="gt-list__content">
        <span className="gt-list__primary">{children}</span>

        {description !== undefined ? (
          <span className="gt-list__description">{description}</span>
        ) : null}
      </span>

      {trailing !== undefined ? (
        <span className="gt-list__trailing">{trailing}</span>
      ) : null}
    </li>
  );
}
