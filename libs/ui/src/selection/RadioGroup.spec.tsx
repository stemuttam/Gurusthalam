import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RadioGroup } from './RadioGroup.js';

const options = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'push', label: 'Push notification' },
] as const;

describe('RadioGroup', () => {
  it('renders its legend and options', () => {
    render(<RadioGroup label="Notification channel" options={options} />);

    expect(screen.getByText('Notification channel')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Email' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'SMS' })).toBeTruthy();
    expect(
      screen.getByRole('radio', { name: 'Push notification' }),
    ).toBeTruthy();
  });

  it('supports an uncontrolled default value', () => {
    render(
      <RadioGroup
        label="Notification channel"
        options={options}
        defaultValue="sms"
      />,
    );

    expect(
      (screen.getByRole('radio', { name: 'SMS' }) as HTMLInputElement).checked,
    ).toBe(true);
  });

  it('updates uncontrolled selection and calls onValueChange', () => {
    const onValueChange = vi.fn();

    render(
      <RadioGroup
        label="Notification channel"
        options={options}
        onValueChange={onValueChange}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Email' }));

    expect(onValueChange).toHaveBeenCalledWith('email');
    expect(
      (screen.getByRole('radio', { name: 'Email' }) as HTMLInputElement)
        .checked,
    ).toBe(true);
  });

  it('supports controlled selection', () => {
    const onValueChange = vi.fn();

    render(
      <RadioGroup
        label="Notification channel"
        options={options}
        value="email"
        onValueChange={onValueChange}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'SMS' }));

    expect(onValueChange).toHaveBeenCalledWith('sms');
    expect(
      (screen.getByRole('radio', { name: 'Email' }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(
      (screen.getByRole('radio', { name: 'SMS' }) as HTMLInputElement).checked,
    ).toBe(false);
  });

  it('uses the supplied name for the native radio group', () => {
    render(
      <RadioGroup
        label="Notification channel"
        name="notification-channel"
        options={options}
      />,
    );

    for (const radio of screen.getAllByRole('radio')) {
      expect((radio as HTMLInputElement).name).toBe('notification-channel');
    }
  });

  it('supports a disabled group', () => {
    render(
      <RadioGroup label="Notification channel" options={options} disabled />,
    );

    for (const radio of screen.getAllByRole('radio')) {
      expect((radio as HTMLInputElement).disabled).toBe(true);
    }
  });

  it('supports disabled individual options', () => {
    render(
      <RadioGroup
        label="Notification channel"
        options={[
          { value: 'email', label: 'Email' },
          { value: 'sms', label: 'SMS', disabled: true },
        ]}
      />,
    );

    expect(
      (screen.getByRole('radio', { name: 'Email' }) as HTMLInputElement)
        .disabled,
    ).toBe(false);
    expect(
      (screen.getByRole('radio', { name: 'SMS' }) as HTMLInputElement).disabled,
    ).toBe(true);
  });

  it('supports required selection', () => {
    render(
      <RadioGroup label="Notification channel" options={options} required />,
    );

    for (const radio of screen.getAllByRole('radio')) {
      expect((radio as HTMLInputElement).required).toBe(true);
    }
  });

  it('renders helper text and associates it with the group', () => {
    render(
      <RadioGroup
        label="Notification channel"
        options={options}
        helperText="Choose how you want to be notified"
      />,
    );

    expect(screen.getByText('Choose how you want to be notified')).toBeTruthy();

    expect(
      screen.getByRole('group').getAttribute('aria-describedby'),
    ).toContain('-help');
  });

  it('renders an accessible validation message', () => {
    render(
      <RadioGroup
        label="Notification channel"
        options={options}
        errorMessage="Choose a notification channel"
      />,
    );

    expect(screen.getByRole('alert').textContent).toBe(
      'Choose a notification channel',
    );
    expect(screen.getByRole('group').getAttribute('aria-invalid')).toBe('true');
  });

  it('supports horizontal orientation', () => {
    const { container } = render(
      <RadioGroup
        label="Notification channel"
        options={options}
        orientation="horizontal"
      />,
    );

    expect(container.querySelector('.gt-radio-group--horizontal')).toBeTruthy();
  });

  it('uses a generated group name when name is omitted', () => {
    render(<RadioGroup label="Notification channel" options={options} />);

    const names = new Set(
      screen
        .getAllByRole('radio')
        .map((radio) => (radio as HTMLInputElement).name),
    );

    expect(names.size).toBe(1);
    expect([...names][0]).toContain('gt-radio-group-');
  });
});
