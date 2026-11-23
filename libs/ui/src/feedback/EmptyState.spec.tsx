import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EmptyState } from './EmptyState.js';

describe('EmptyState', () => {
  it('renders its title', () => {
    render(<EmptyState title="No courses found" />);

    expect(
      screen.getByRole('heading', { name: 'No courses found' }),
    ).toBeTruthy();
  });

  it('renders an optional description', () => {
    render(
      <EmptyState
        title="No courses found"
        description="Courses will appear here when they are available."
      />,
    );

    expect(
      screen.getByText('Courses will appear here when they are available.'),
    ).toBeTruthy();
  });

  it('renders an optional icon', () => {
    render(
      <EmptyState
        title="No courses found"
        icon={<span data-testid="empty-icon">Icon</span>}
      />,
    );

    expect(screen.getByTestId('empty-icon')).toBeTruthy();
    expect(
      screen
        .getByTestId('empty-icon')
        .parentElement?.getAttribute('aria-hidden'),
    ).toBe('true');
  });

  it('renders an optional action', () => {
    render(
      <EmptyState
        title="No courses found"
        action={<button type="button">Create course</button>}
      />,
    );

    expect(screen.getByRole('button', { name: 'Create course' })).toBeTruthy();
  });

  it('renders title, description, icon and action together', () => {
    render(
      <EmptyState
        title="No assessments"
        description="Create an assessment to get started."
        icon={<span>Clipboard</span>}
        action={<button type="button">Create assessment</button>}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'No assessments' }),
    ).toBeTruthy();

    expect(
      screen.getByText('Create an assessment to get started.'),
    ).toBeTruthy();

    expect(
      screen.getByRole('button', { name: 'Create assessment' }),
    ).toBeTruthy();
  });

  it('supports custom classes and HTML attributes', () => {
    render(
      <EmptyState
        title="No results"
        className="search-empty-state"
        data-testid="empty-state"
      />,
    );

    const section = screen.getByTestId('empty-state');

    expect(section.className).toContain('search-empty-state');
  });

  it('associates the section with its heading', () => {
    const { container } = render(<EmptyState title="No notifications" />);

    const section = container.querySelector('section');
    const heading = screen.getByRole('heading', {
      name: 'No notifications',
    });

    expect(section?.getAttribute('aria-labelledby')).toBe(heading.id);
  });

  it('supports React content in its title', () => {
    render(
      <EmptyState
        title={
          <>
            No <strong>students</strong> found
          </>
        }
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'No students found' }),
    ).toBeTruthy();
  });
});
