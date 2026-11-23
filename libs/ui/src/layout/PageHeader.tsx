import { useId, type HTMLAttributes, type ReactNode } from 'react';

export type PageHeaderHeadingLevel = 'h1' | 'h2' | 'h3';

export interface PageHeaderProps extends Omit<
  HTMLAttributes<HTMLElement>,
  'title' | 'children'
> {
  /**
   * Main heading displayed at the top of the page.
   */
  title: ReactNode;

  /**
   * Optional supporting text displayed below the title.
   */
  description?: ReactNode;

  /**
   * Optional small contextual label displayed above the title.
   */
  eyebrow?: ReactNode;

  /**
   * Optional breadcrumb navigation content.
   *
   * Supply the breadcrumb links or elements. The component provides
   * the accessible navigation landmark.
   */
  breadcrumbs?: ReactNode;

  /**
   * Optional metadata displayed alongside the page description.
   */
  metadata?: ReactNode;

  /**
   * Optional page-level actions, such as buttons.
   */
  actions?: ReactNode;

  /**
   * Controls the semantic heading level.
   *
   * @default h1
   */
  headingLevel?: PageHeaderHeadingLevel;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  breadcrumbs,
  metadata,
  actions,
  headingLevel = 'h1',
  className,
  ...props
}: PageHeaderProps) {
  const generatedId = useId();
  const titleId = `gt-page-header-${generatedId}-title`;
  const Heading = headingLevel;

  const classes = ['gt-page-header', className ?? ''].filter(Boolean).join(' ');

  return (
    <header {...props} className={classes} aria-labelledby={titleId}>
      <div className="gt-page-header__main">
        {breadcrumbs ? (
          <nav className="gt-page-header__breadcrumbs" aria-label="Breadcrumb">
            {breadcrumbs}
          </nav>
        ) : null}

        {eyebrow ? (
          <div className="gt-page-header__eyebrow">{eyebrow}</div>
        ) : null}

        <Heading id={titleId} className="gt-page-header__title">
          {title}
        </Heading>

        {description ? (
          <div className="gt-page-header__description">{description}</div>
        ) : null}

        {metadata ? (
          <div className="gt-page-header__metadata">{metadata}</div>
        ) : null}
      </div>

      {actions ? (
        <div className="gt-page-header__actions">{actions}</div>
      ) : null}
    </header>
  );
}
