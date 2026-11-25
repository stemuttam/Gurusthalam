import { useState, type HTMLAttributes } from 'react';

export type PaginationItem = number | 'start-ellipsis' | 'end-ellipsis';

export interface PaginationProps extends HTMLAttributes<HTMLElement> {
  /** Total number of available pages. */
  totalPages: number;
  /** Current page. Supplying this prop makes the component controlled. */
  page?: number;
  /** Initial page for uncontrolled usage. */
  defaultPage?: number;
  /** Called whenever the user selects a different page. */
  onPageChange?: (page: number) => void;
  /** Number of pages displayed on each side of the current page. */
  siblingCount?: number;
  /** Number of pages always displayed at the beginning and end. */
  boundaryCount?: number;
  /** Whether First and Last navigation buttons are displayed. */
  showFirstLast?: boolean;
  /** Accessible label for the navigation landmark. */
  ariaLabel?: string;
  /** Custom label for the Previous button. */
  previousLabel?: string;
  /** Custom label for the Next button. */
  nextLabel?: string;
  /** Custom label for the First button. */
  firstLabel?: string;
  /** Custom label for the Last button. */
  lastLabel?: string;
}

function normalizePage(page: number, totalPages: number): number {
  if (totalPages <= 0) {
    return 1;
  }

  if (!Number.isFinite(page)) {
    return 1;
  }

  return Math.min(totalPages, Math.max(1, Math.floor(page)));
}

function normalizeCount(count: number): number {
  if (!Number.isFinite(count)) {
    return 0;
  }

  return Math.max(0, Math.floor(count));
}

function range(start: number, end: number): number[] {
  if (end < start) {
    return [];
  }

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export function getPaginationItems(
  totalPages: number,
  currentPage: number,
  siblingCount = 1,
  boundaryCount = 1,
): PaginationItem[] {
  const total = Math.max(0, Math.floor(totalPages));

  if (total === 0) {
    return [];
  }

  const current = normalizePage(currentPage, total);
  const siblings = normalizeCount(siblingCount);
  const boundaries = normalizeCount(boundaryCount);

  const startPages = range(1, Math.min(boundaries, total));
  const endPages = range(
    Math.max(total - boundaries + 1, boundaries + 1),
    total,
  );

  const siblingsStart = Math.max(
    Math.min(current - siblings, total - boundaries - siblings * 2 - 1),
    boundaries + 2,
  );

  const siblingsEnd = Math.min(
    Math.max(current + siblings, boundaries + siblings * 2 + 2),
    total - boundaries - 1,
  );

  const items: PaginationItem[] = [...startPages];

  if (siblingsStart > boundaries + 2) {
    items.push('start-ellipsis');
  } else if (boundaries + 1 < total - boundaries) {
    items.push(boundaries + 1);
  }

  items.push(...range(siblingsStart, siblingsEnd));

  if (siblingsEnd < total - boundaries - 1) {
    items.push('end-ellipsis');
  } else if (total - boundaries > boundaries) {
    items.push(total - boundaries);
  }

  items.push(...endPages);

  return items.filter((item, index) => items.indexOf(item) === index);
}

export function Pagination({
  totalPages,
  page,
  defaultPage = 1,
  onPageChange,
  siblingCount = 1,
  boundaryCount = 1,
  showFirstLast = false,
  ariaLabel = 'Pagination',
  previousLabel = 'Previous',
  nextLabel = 'Next',
  firstLabel = 'First',
  lastLabel = 'Last',
  className,
  ...props
}: PaginationProps) {
  const [internalPage, setInternalPage] = useState(() =>
    normalizePage(defaultPage, totalPages),
  );

  const safeTotalPages = Number.isFinite(totalPages)
    ? Math.max(0, Math.floor(totalPages))
    : 0;

  const isControlled = page !== undefined;
  const currentPage = normalizePage(
    isControlled ? page : internalPage,
    safeTotalPages,
  );

  if (safeTotalPages === 0) {
    return null;
  }

  const items = getPaginationItems(
    safeTotalPages,
    currentPage,
    siblingCount,
    boundaryCount,
  );

  const goToPage = (nextPage: number) => {
    const normalizedPage = normalizePage(nextPage, safeTotalPages);

    if (normalizedPage === currentPage) {
      return;
    }

    if (!isControlled) {
      setInternalPage(normalizedPage);
    }

    onPageChange?.(normalizedPage);
  };

  const classes = ['gt-pagination', className ?? ''].filter(Boolean).join(' ');

  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage === safeTotalPages;

  return (
    <nav {...props} className={classes} aria-label={ariaLabel}>
      <ul className="gt-pagination__list">
        {showFirstLast && (
          <li className="gt-pagination__item">
            <button
              type="button"
              className="gt-pagination__button gt-pagination__navigation"
              onClick={() => goToPage(1)}
              disabled={isFirstPage}
              aria-label={firstLabel}
            >
              <span aria-hidden="true">«</span>
              <span className="gt-pagination__navigation-label">
                {firstLabel}
              </span>
            </button>
          </li>
        )}

        <li className="gt-pagination__item">
          <button
            type="button"
            className="gt-pagination__button gt-pagination__navigation"
            onClick={() => goToPage(currentPage - 1)}
            disabled={isFirstPage}
            aria-label={previousLabel}
          >
            <span aria-hidden="true">‹</span>
            <span className="gt-pagination__navigation-label">
              {previousLabel}
            </span>
          </button>
        </li>

        {items.map((item, index) => {
          if (typeof item !== 'number') {
            return (
              <li className="gt-pagination__item" key={item} aria-hidden="true">
                <span className="gt-pagination__ellipsis">…</span>
              </li>
            );
          }

          const isCurrentPage = item === currentPage;

          return (
            <li className="gt-pagination__item" key={`page-${item}-${index}`}>
              <button
                type="button"
                className={[
                  'gt-pagination__button',
                  'gt-pagination__page',
                  isCurrentPage ? 'gt-pagination__page--current' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => goToPage(item)}
                aria-label={`Page ${item}`}
                aria-current={isCurrentPage ? 'page' : undefined}
              >
                {item}
              </button>
            </li>
          );
        })}

        <li className="gt-pagination__item">
          <button
            type="button"
            className="gt-pagination__button gt-pagination__navigation"
            onClick={() => goToPage(currentPage + 1)}
            disabled={isLastPage}
            aria-label={nextLabel}
          >
            <span className="gt-pagination__navigation-label">{nextLabel}</span>
            <span aria-hidden="true">›</span>
          </button>
        </li>

        {showFirstLast && (
          <li className="gt-pagination__item">
            <button
              type="button"
              className="gt-pagination__button gt-pagination__navigation"
              onClick={() => goToPage(safeTotalPages)}
              disabled={isLastPage}
              aria-label={lastLabel}
            >
              <span className="gt-pagination__navigation-label">
                {lastLabel}
              </span>
              <span aria-hidden="true">»</span>
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
}
