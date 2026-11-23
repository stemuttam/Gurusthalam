import { render, screen } from '@testing-library/react';

import { Progress } from './Progress.js';

describe('Progress', () => {
  it('renders a progressbar', () => {
    render(<Progress value={40} />);

    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('exposes the current value accessibly', () => {
    render(<Progress value={40} />);

    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      '40',
    );
  });

  it('supports a custom maximum value', () => {
    render(<Progress value={25} max={50} />);

    const progressbar = screen.getByRole('progressbar');

    expect(progressbar.getAttribute('aria-valuemax')).toBe('50');
    expect(progressbar.getAttribute('aria-valuenow')).toBe('25');
  });

  it('clamps values below zero', () => {
    render(<Progress value={-10} />);

    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      '0',
    );
  });

  it('clamps values above the maximum', () => {
    render(<Progress value={150} max={100} />);

    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      '100',
    );
  });

  it('supports indeterminate progress', () => {
    render(<Progress value={null} />);

    const progressbar = screen.getByRole('progressbar');

    expect(progressbar.getAttribute('aria-valuenow')).toBeNull();
    expect(progressbar.className).toContain('gt-progress--indeterminate');
  });

  it('renders an accessible label', () => {
    render(<Progress value={50} label="Uploading files" />);

    expect(
      screen.getByRole('progressbar', {
        name: 'Uploading files',
      }),
    ).toBeTruthy();
  });

  it('supports an explicit accessible label', () => {
    render(<Progress value={50} aria-label="Course completion" />);

    expect(
      screen.getByRole('progressbar', {
        name: 'Course completion',
      }),
    ).toBeTruthy();
  });

  it('shows the percentage when showValue is enabled', () => {
    render(<Progress value={65} label="Course completion" showValue />);

    expect(screen.getByText('65%')).toBeTruthy();
  });

  it('supports a custom displayed value label', () => {
    render(<Progress value={65} showValue valueLabel="65 of 100 lessons" />);

    expect(screen.getByText('65 of 100 lessons')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe(
      '65 of 100 lessons',
    );
  });

  it('uses the default maximum when max is invalid', () => {
    render(<Progress value={25} max={0} />);

    expect(screen.getByRole('progressbar').getAttribute('aria-valuemax')).toBe(
      '100',
    );
  });

  it('supports custom CSS classes', () => {
    render(<Progress value={50} className="custom-progress" />);

    expect(screen.getByRole('progressbar').className).toContain(
      'custom-progress',
    );
  });
});
