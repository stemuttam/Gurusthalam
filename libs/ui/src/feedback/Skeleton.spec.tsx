import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Skeleton } from './Skeleton.js';

describe('Skeleton', () => {
  it('renders with the base skeleton class', () => {
    const { container } = render(<Skeleton />);

    expect(container.firstElementChild?.className).toContain('gt-skeleton');
  });

  it('uses the text variant by default', () => {
    const { container } = render(<Skeleton />);

    expect(container.firstElementChild?.className).toContain(
      'gt-skeleton--text',
    );
  });

  it('supports the circular variant', () => {
    const { container } = render(<Skeleton variant="circular" />);

    expect(container.firstElementChild?.className).toContain(
      'gt-skeleton--circular',
    );
  });

  it('supports the rectangular variant', () => {
    const { container } = render(<Skeleton variant="rectangular" />);

    expect(container.firstElementChild?.className).toContain(
      'gt-skeleton--rectangular',
    );
  });

  it('supports custom dimensions', () => {
    const { container } = render(<Skeleton width="240px" height="48px" />);

    const skeleton = container.firstElementChild as HTMLElement;

    expect(skeleton.style.width).toBe('240px');
    expect(skeleton.style.height).toBe('48px');
  });

  it('supports numeric dimensions', () => {
    const { container } = render(<Skeleton width={120} height={32} />);

    const skeleton = container.firstElementChild as HTMLElement;

    expect(skeleton.style.width).toBe('120px');
    expect(skeleton.style.height).toBe('32px');
  });

  it('supports disabling animation', () => {
    const { container } = render(<Skeleton animated={false} />);

    expect(container.firstElementChild?.className).toContain(
      'gt-skeleton--static',
    );
  });

  it('supports custom classes', () => {
    const { container } = render(
      <Skeleton className="course-card-placeholder" />,
    );

    expect(container.firstElementChild?.className).toContain(
      'course-card-placeholder',
    );
  });

  it('is hidden from assistive technology', () => {
    const { container } = render(<Skeleton />);

    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });

  it('preserves additional HTML attributes', () => {
    const { container } = render(
      <Skeleton data-testid="loading-placeholder" />,
    );

    expect(container.firstElementChild?.getAttribute('data-testid')).toBe(
      'loading-placeholder',
    );
  });
});
