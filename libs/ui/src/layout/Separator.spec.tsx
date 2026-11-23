import { render, screen } from '@testing-library/react';

import { Separator } from './Separator.js';

describe('Separator', () => {
  it('renders a horizontal separator by default', () => {
    const { container } = render(<Separator />);

    const separator = container.querySelector('.gt-separator');

    expect(separator).toBeTruthy();
    expect(separator?.className).toContain('gt-separator--horizontal');
    expect(separator?.getAttribute('data-orientation')).toBe('horizontal');
  });

  it('renders a vertical separator', () => {
    const { container } = render(<Separator orientation="vertical" />);

    const separator = container.querySelector('.gt-separator');

    expect(separator).toBeTruthy();
    expect(separator?.className).toContain('gt-separator--vertical');
    expect(separator?.getAttribute('data-orientation')).toBe('vertical');
  });

  it('is decorative by default', () => {
    const { container } = render(<Separator />);

    const separator = container.querySelector('.gt-separator');

    expect(separator?.getAttribute('aria-hidden')).toBe('true');
    expect(separator?.getAttribute('role')).toBeNull();
  });

  it('exposes separator semantics when not decorative', () => {
    render(<Separator decorative={false} />);

    expect(screen.getByRole('separator')).toBeTruthy();
  });

  it('exposes horizontal orientation to assistive technology', () => {
    render(<Separator decorative={false} orientation="horizontal" />);

    expect(screen.getByRole('separator').getAttribute('aria-orientation')).toBe(
      'horizontal',
    );
  });

  it('exposes vertical orientation to assistive technology', () => {
    render(<Separator decorative={false} orientation="vertical" />);

    expect(screen.getByRole('separator').getAttribute('aria-orientation')).toBe(
      'vertical',
    );
  });

  it('supports a custom class name', () => {
    const { container } = render(<Separator className="custom-separator" />);

    expect(container.querySelector('.gt-separator')?.className).toContain(
      'custom-separator',
    );
  });

  it('supports custom data attributes', () => {
    const { container } = render(
      <Separator data-testid="content-divider" data-section="course-details" />,
    );

    const separator = container.querySelector(
      '[data-testid="content-divider"]',
    );

    expect(separator?.getAttribute('data-section')).toBe('course-details');
  });

  it('does not expose decorative separators to the accessibility tree', () => {
    const { container } = render(<Separator decorative />);

    expect(screen.queryByRole('separator')).toBeNull();
    expect(
      container.querySelector('.gt-separator')?.getAttribute('aria-hidden'),
    ).toBe('true');
  });
});
