import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Switch } from './Switch.js';

describe('Switch', () => {
  it('renders with the switch role and accessible label', () => {
    render(<Switch label="Enable notifications" />);

    expect(
      screen.getByRole('switch', {
        name: 'Enable notifications',
      }),
    ).toBeTruthy();
  });

  it('supports uncontrolled checked state', () => {
    render(<Switch label="Enable notifications" defaultChecked />);

    expect((screen.getByRole('switch') as HTMLInputElement).checked).toBe(true);
  });

  it('notifies when its value changes', () => {
    const onChange =
      vi.fn<(event: React.ChangeEvent<HTMLInputElement>) => void>();

    render(<Switch label="Enable notifications" onChange={onChange} />);

    fireEvent.click(screen.getByRole('switch'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({
          checked: true,
        }),
      }),
    );
  });

  it('supports controlled checked state', () => {
    const onChange =
      vi.fn<(event: React.ChangeEvent<HTMLInputElement>) => void>();

    render(
      <Switch
        label="Enable notifications"
        checked={false}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('switch'));

    expect(onChange).toHaveBeenCalledTimes(1);

    expect((screen.getByRole('switch') as HTMLInputElement).checked).toBe(
      false,
    );
  });

  it('renders a description and associates it with the switch', () => {
    render(
      <Switch
        label="Enable notifications"
        description="Receive important account updates"
      />,
    );

    const control = screen.getByRole('switch');

    expect(screen.getByText('Receive important account updates')).toBeTruthy();

    expect(control.getAttribute('aria-describedby')).toContain('-description');
  });

  it('supports disabled state', () => {
    render(<Switch label="Enable notifications" disabled />);

    expect((screen.getByRole('switch') as HTMLInputElement).disabled).toBe(
      true,
    );
  });

  it('supports required state', () => {
    render(<Switch label="Enable notifications" required />);

    expect((screen.getByRole('switch') as HTMLInputElement).required).toBe(
      true,
    );
  });

  it('supports a custom id', () => {
    render(<Switch id="notifications-switch" label="Enable notifications" />);

    expect(screen.getByRole('switch').id).toBe('notifications-switch');
  });

  it('forwards its ref to the native input', () => {
    const ref = {
      current: null as HTMLInputElement | null,
    };

    render(<Switch ref={ref} label="Enable notifications" />);

    expect(ref.current).toBe(screen.getByRole('switch'));
  });
});
