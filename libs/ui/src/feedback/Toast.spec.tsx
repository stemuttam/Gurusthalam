import { fireEvent, render, screen } from '@testing-library/react';

import { Toast } from './Toast.js';

describe('Toast', () => {
  it('renders its description', () => {
    render(<Toast description="Your changes have been saved." />);

    expect(screen.getByText('Your changes have been saved.')).toBeTruthy();
  });

  it('renders children as the description when description is omitted', () => {
    render(<Toast>Your session is active.</Toast>);

    expect(screen.getByText('Your session is active.')).toBeTruthy();
  });

  it('renders an optional title', () => {
    render(
      <Toast title="Changes saved" description="Your profile was updated." />,
    );

    expect(screen.getByText('Changes saved')).toBeTruthy();
    expect(screen.getByText('Your profile was updated.')).toBeTruthy();
  });

  it('uses a status role by default', () => {
    render(<Toast description="Operation completed." />);

    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('uses an alert role for errors', () => {
    render(<Toast variant="error" description="Unable to save changes." />);

    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('uses assertive live announcements for errors', () => {
    render(<Toast variant="error" description="Something went wrong." />);

    expect(screen.getByRole('alert').getAttribute('aria-live')).toBe(
      'assertive',
    );
  });

  it('uses polite live announcements for non-error variants', () => {
    render(<Toast variant="success" description="Everything is up to date." />);

    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
  });

  it('renders a dismiss button when onDismiss is provided', () => {
    const onDismiss = vi.fn();

    render(<Toast description="Notification" onDismiss={onDismiss} />);

    expect(
      screen.getByRole('button', {
        name: 'Dismiss notification',
      }),
    ).toBeTruthy();
  });

  it('calls onDismiss when the dismiss button is clicked', () => {
    const onDismiss = vi.fn();

    render(<Toast description="Notification" onDismiss={onDismiss} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Dismiss notification',
      }),
    );

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('supports a custom dismiss label', () => {
    render(
      <Toast
        description="Notification"
        onDismiss={() => undefined}
        dismissLabel="Close message"
      />,
    );

    expect(screen.getByRole('button', { name: 'Close message' })).toBeTruthy();
  });

  it('does not render a dismiss button when onDismiss is omitted', () => {
    render(<Toast description="Notification" />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('preserves a custom class name', () => {
    render(<Toast description="Notification" className="custom-toast" />);

    expect(screen.getByRole('status').className).toContain('custom-toast');
  });
});
