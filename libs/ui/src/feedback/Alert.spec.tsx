import { render, screen } from '@testing-library/react';

import { Alert } from './Alert.js';

describe('Alert', () => {
  it('renders its message', () => {
    render(<Alert>Changes saved successfully.</Alert>);

    expect(screen.getByText('Changes saved successfully.')).toBeTruthy();
  });

  it('renders an optional title', () => {
    render(
      <Alert title="Important notice">Your session will expire soon.</Alert>,
    );

    expect(screen.getByText('Important notice')).toBeTruthy();
  });

  it('uses an alert role for danger messages', () => {
    render(<Alert variant="danger">An unexpected error occurred.</Alert>);

    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('uses a status role for success messages', () => {
    render(<Alert variant="success">Operation completed.</Alert>);

    expect(screen.getByRole('status')).toBeTruthy();
  });
});
