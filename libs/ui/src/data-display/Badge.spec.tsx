import { render, screen } from '@testing-library/react';

import { Badge } from './Badge.js';

describe('Badge', () => {
  it('renders its text', () => {
    render(<Badge>Published</Badge>);

    expect(screen.getByText('Published')).toBeTruthy();
  });

  it('uses the neutral variant by default', () => {
    render(<Badge>Draft</Badge>);

    expect(screen.getByText('Draft').className).toBe('gt-badge');
  });

  it('supports semantic success styling', () => {
    render(<Badge variant="success">Completed</Badge>);

    expect(screen.getByText('Completed').className).toContain(
      'gt-badge--success',
    );
  });

  it('supports custom accessible attributes', () => {
    render(
      <Badge variant="warning" aria-label="Assessment pending">
        Pending
      </Badge>,
    );

    expect(screen.getByLabelText('Assessment pending')).toBeTruthy();
  });
});
