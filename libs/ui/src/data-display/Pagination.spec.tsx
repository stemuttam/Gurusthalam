import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { getPaginationItems, Pagination } from './Pagination.js';

describe('getPaginationItems', () => {
  it('returns all pages when the total is small', () => {
    expect(getPaginationItems(5, 3)).toEqual([1, 2, 3, 4, 5]);
  });

  it('adds ellipses when there are many pages', () => {
    expect(getPaginationItems(20, 10)).toEqual([
      1,
      'start-ellipsis',
      9,
      10,
      11,
      'end-ellipsis',
      20,
    ]);
  });

  it('handles the first page', () => {
    expect(getPaginationItems(10, 1)).toEqual([
      1,
      2,
      3,
      4,
      5,
      'end-ellipsis',
      10,
    ]);
  });

  it('handles the last page', () => {
    expect(getPaginationItems(10, 10)).toEqual([
      1,
      'start-ellipsis',
      6,
      7,
      8,
      9,
      10,
    ]);
  });

  it('supports custom sibling and boundary counts', () => {
    expect(getPaginationItems(20, 10, 2, 2)).toEqual([
      1,
      2,
      'start-ellipsis',
      8,
      9,
      10,
      11,
      12,
      'end-ellipsis',
      19,
      20,
    ]);
  });

  it('returns an empty array when there are no pages', () => {
    expect(getPaginationItems(0, 1)).toEqual([]);
  });

  it('normalizes an invalid current page', () => {
    expect(getPaginationItems(5, 99)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('Pagination', () => {
  it('renders the page navigation landmark', () => {
    render(<Pagination totalPages={5} />);

    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeTruthy();
  });

  it('renders page buttons', () => {
    render(<Pagination totalPages={5} />);

    for (let page = 1; page <= 5; page += 1) {
      expect(screen.getByRole('button', { name: `Page ${page}` })).toBeTruthy();
    }
  });

  it('selects the first page by default', () => {
    render(<Pagination totalPages={5} />);

    expect(
      screen
        .getByRole('button', { name: 'Page 1' })
        .getAttribute('aria-current'),
    ).toBe('page');
  });

  it('supports an initial default page', () => {
    render(<Pagination totalPages={5} defaultPage={3} />);

    expect(
      screen
        .getByRole('button', { name: 'Page 3' })
        .getAttribute('aria-current'),
    ).toBe('page');
  });

  it('changes the page when a page button is selected', () => {
    const onPageChange = vi.fn();

    render(<Pagination totalPages={5} onPageChange={onPageChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Page 3' }));

    expect(onPageChange).toHaveBeenCalledWith(3);
    expect(
      screen
        .getByRole('button', { name: 'Page 3' })
        .getAttribute('aria-current'),
    ).toBe('page');
  });

  it('supports previous page navigation', () => {
    const onPageChange = vi.fn();

    render(
      <Pagination totalPages={5} defaultPage={3} onPageChange={onPageChange} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));

    expect(onPageChange).toHaveBeenCalledWith(2);
    expect(
      screen
        .getByRole('button', { name: 'Page 2' })
        .getAttribute('aria-current'),
    ).toBe('page');
  });

  it('supports next page navigation', () => {
    const onPageChange = vi.fn();

    render(<Pagination totalPages={5} onPageChange={onPageChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(onPageChange).toHaveBeenCalledWith(2);
    expect(
      screen
        .getByRole('button', { name: 'Page 2' })
        .getAttribute('aria-current'),
    ).toBe('page');
  });

  it('disables previous navigation on the first page', () => {
    render(<Pagination totalPages={5} />);

    expect(
      screen.getByRole('button', { name: 'Previous' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('disables next navigation on the last page', () => {
    render(<Pagination totalPages={5} defaultPage={5} />);

    expect(
      screen.getByRole('button', { name: 'Next' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('supports first and last page buttons', () => {
    const onPageChange = vi.fn();

    render(
      <Pagination
        totalPages={10}
        defaultPage={5}
        showFirstLast
        onPageChange={onPageChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Last' }));

    expect(onPageChange).toHaveBeenCalledWith(10);
    expect(
      screen
        .getByRole('button', { name: 'Page 10' })
        .getAttribute('aria-current'),
    ).toBe('page');
  });

  it('does not render when there are no pages', () => {
    const { container } = render(<Pagination totalPages={0} />);

    expect(container.firstChild).toBeNull();
  });

  it('clamps an initial page to the available range', () => {
    render(<Pagination totalPages={5} defaultPage={20} />);

    expect(
      screen
        .getByRole('button', { name: 'Page 5' })
        .getAttribute('aria-current'),
    ).toBe('page');
  });

  it('does not change the page when the current page is selected', () => {
    const onPageChange = vi.fn();

    render(<Pagination totalPages={5} onPageChange={onPageChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Page 1' }));

    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('supports controlled page selection', () => {
    const onPageChange = vi.fn();

    render(<Pagination totalPages={5} page={3} onPageChange={onPageChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Page 4' }));

    expect(onPageChange).toHaveBeenCalledWith(4);
    expect(
      screen
        .getByRole('button', { name: 'Page 3' })
        .getAttribute('aria-current'),
    ).toBe('page');
  });

  it('supports a custom accessible navigation label', () => {
    render(<Pagination totalPages={5} ariaLabel="Course pages" />);

    expect(
      screen.getByRole('navigation', { name: 'Course pages' }),
    ).toBeTruthy();
  });

  it('supports custom navigation labels', () => {
    render(
      <Pagination
        totalPages={5}
        previousLabel="Go back"
        nextLabel="Go forward"
      />,
    );

    expect(screen.getByRole('button', { name: 'Go back' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Go forward' })).toBeTruthy();
  });

  it('supports custom classes and HTML attributes', () => {
    render(
      <Pagination
        totalPages={5}
        className="course-pagination"
        data-testid="pagination"
      />,
    );

    const navigation = screen.getByTestId('pagination');

    expect(navigation.className).toContain('course-pagination');
  });

  it('renders ellipses for large page ranges', () => {
    render(<Pagination totalPages={20} page={10} />);

    expect(screen.getAllByText('…')).toHaveLength(2);
  });

  it('clamps a controlled page to the available range', () => {
    render(<Pagination totalPages={5} page={99} />);

    expect(
      screen
        .getByRole('button', { name: 'Page 5' })
        .getAttribute('aria-current'),
    ).toBe('page');
  });
});
