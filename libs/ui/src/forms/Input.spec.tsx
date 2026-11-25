// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Input } from './Input.js';

describe('Input', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a labelled input', () => {
    render(<Input label="Email address" />);

    expect(screen.getByRole('textbox', { name: 'Email address' })).toBeTruthy();
  });

  it('supports native input types and placeholders', () => {
    render(
      <Input label="Password" type="password" placeholder="Enter password" />,
    );

    const input = screen.getByLabelText('Password');

    expect(input.getAttribute('type')).toBe('password');
    expect(input.getAttribute('placeholder')).toBe('Enter password');
  });

  it('supports controlled values and change handlers', () => {
    let currentValue = '';

    const { rerender } = render(
      <Input
        label="Name"
        value={currentValue}
        onChange={(event) => {
          currentValue = event.target.value;
        }}
      />,
    );

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Uttam' },
    });

    expect(currentValue).toBe('Uttam');

    rerender(
      <Input
        label="Name"
        value={currentValue}
        onChange={(event) => {
          currentValue = event.target.value;
        }}
      />,
    );

    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe(
      'Uttam',
    );
  });

  it('supports uncontrolled default values', () => {
    render(<Input label="City" defaultValue="Kanpur" />);

    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe(
      'Kanpur',
    );
  });

  it('renders helper text and associates it with the input', () => {
    render(<Input label="Username" helperText="Use at least 4 characters." />);

    const input = screen.getByRole('textbox');
    const helper = screen.getByText('Use at least 4 characters.');

    expect(input.getAttribute('aria-describedby')).toContain(helper.id);
  });

  it('renders an accessible error message', () => {
    render(<Input label="Email" errorMessage="Enter a valid email address." />);

    const input = screen.getByRole('textbox');
    const error = screen.getByText('Enter a valid email address.');

    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toContain(error.id);
  });

  it('supports an explicitly invalid state', () => {
    render(<Input label="Reference" invalid />);

    expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBe(
      'true',
    );
  });

  it('supports required and disabled states', () => {
    render(<Input label="Student ID" required disabled />);

    const input = screen.getByRole('textbox');

    expect(input.hasAttribute('required')).toBe(true);
    expect(input.hasAttribute('disabled')).toBe(true);
  });

  it('supports custom ids and class names', () => {
    render(
      <Input
        id="student-email"
        label="Email"
        className="custom-input"
        fieldClassName="custom-field"
      />,
    );

    const input = screen.getByRole('textbox');

    expect(input.id).toBe('student-email');
    expect(input.className).toContain('gt-input');
    expect(input.className).toContain('custom-input');
    expect(input.parentElement?.className).toContain('custom-field');
  });

  it('supports refs', () => {
    const ref = { current: null as HTMLInputElement | null };

    render(<Input ref={ref} label="Search" />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('preserves a supplied aria-errormessage', () => {
    render(<Input label="Email" aria-errormessage="external-email-error" />);

    expect(screen.getByRole('textbox').getAttribute('aria-errormessage')).toBe(
      'external-email-error',
    );
  });
});
