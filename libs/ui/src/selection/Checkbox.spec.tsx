import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Checkbox } from './Checkbox.js';

describe('Checkbox', () => {
  it('renders its label', () => {
    render(<Checkbox label="Accept terms" />);

    expect(screen.getByRole('checkbox', { name: 'Accept terms' })).toBeTruthy();
  });

  it('supports uncontrolled checked state', () => {
    render(<Checkbox label="Accept terms" defaultChecked />);

    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it('notifies when its value changes', () => {
    const onChange =
      vi.fn<(event: React.ChangeEvent<HTMLInputElement>) => void>();

    render(<Checkbox label="Accept terms" onChange={onChange} />);

    fireEvent.click(screen.getByRole('checkbox'));

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
      <Checkbox label="Accept terms" checked={false} onChange={onChange} />,
    );

    fireEvent.click(screen.getByRole('checkbox'));

    expect(onChange).toHaveBeenCalledTimes(1);

    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(
      false,
    );
  });

  it('renders helper text and associates it with the input', () => {
    render(<Checkbox label="Subscribe" helperText="Receive product updates" />);

    const input = screen.getByRole('checkbox');

    expect(screen.getByText('Receive product updates')).toBeTruthy();

    expect(input.getAttribute('aria-describedby')).toContain('gt-checkbox-');
  });

  it('renders an accessible validation message', () => {
    render(
      <Checkbox label="Accept terms" errorMessage="This field is required" />,
    );

    const input = screen.getByRole('checkbox');

    expect(screen.getByRole('alert').textContent).toBe(
      'This field is required',
    );

    expect(input.getAttribute('aria-invalid')).toBe('true');

    expect(input.getAttribute('aria-describedby')).toContain('-error');
  });

  it('supports disabled state', () => {
    render(<Checkbox label="Unavailable" disabled />);

    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(
      true,
    );
  });

  it('supports required state', () => {
    render(<Checkbox label="Required choice" required />);

    expect((screen.getByRole('checkbox') as HTMLInputElement).required).toBe(
      true,
    );
  });

  it('supports a custom id', () => {
    render(<Checkbox id="terms-checkbox" label="Accept terms" />);

    expect(screen.getByRole('checkbox').id).toBe('terms-checkbox');
  });

  it('forwards its ref to the native input', () => {
    const ref = {
      current: null as HTMLInputElement | null,
    };

    render(<Checkbox ref={ref} label="Accept terms" />);

    expect(ref.current).toBe(screen.getByRole('checkbox'));
  });
});
