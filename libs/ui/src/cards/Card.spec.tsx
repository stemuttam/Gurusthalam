import { render, screen } from '@testing-library/react';

import { Card, StatCard } from './Card.js';

describe('Card', () => {
  it('renders its children', () => {
    render(
      <Card>
        <p>Course information</p>
      </Card>,
    );

    expect(screen.getByText('Course information')).toBeTruthy();
  });

  it('supports interactive styling', () => {
    const { container } = render(<Card interactive>Content</Card>);

    expect(container.firstElementChild?.className).toContain(
      'gt-card--interactive',
    );
  });
});

describe('StatCard', () => {
  it('renders its label and value', () => {
    render(<StatCard label="Total courses" value={125} />);

    expect(screen.getByText('Total courses')).toBeTruthy();
    expect(screen.getByText('125')).toBeTruthy();
  });

  it('renders an optional description', () => {
    render(
      <StatCard
        label="Students"
        value="1,250"
        description="Across all institutions"
      />,
    );

    expect(screen.getByText('Across all institutions')).toBeTruthy();
  });
});
