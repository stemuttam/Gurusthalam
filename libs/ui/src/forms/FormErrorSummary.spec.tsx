// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Form } from './Form.js';
import { FormErrorSummary } from './FormErrorSummary.js';
import { FormField } from './FormField.js';
import { Input } from './Input.js';

afterEach(() => {
  cleanup();
});

describe('FormErrorSummary', () => {
  it('renders nothing when there are no errors', () => {
    const { container } = render(<FormErrorSummary />);

    expect(container.firstChild).toBeNull();
  });

  it('renders a summary from the Form validation context', () => {
    render(
      <Form
        validationErrors={{
          email: 'Enter a valid email address.',
          password: 'Password is required.',
        }}
      >
        <FormErrorSummary />
      </Form>,
    );

    expect(
      screen.getByRole('alert', {
        name: 'There are problems with your submission',
      }),
    ).toBeTruthy();

    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
    expect(screen.getByText('Password is required.')).toBeTruthy();
  });

  it('links field errors to their named controls', () => {
    render(
      <Form validationErrors={{ email: 'Enter a valid email address.' }}>
        <FormErrorSummary />
        <FormField name="email" label="Email address">
          <Input />
        </FormField>
      </Form>,
    );

    expect(
      screen
        .getByRole('link', {
          name: 'Enter a valid email address.',
        })
        .getAttribute('href'),
    ).toBe('#email');

    expect(screen.getByLabelText('Email address').id).toBe('email');
  });

  it('renders form-level errors without a field link', () => {
    render(
      <Form validationErrors={{ _form: 'The request could not be completed.' }}>
        <FormErrorSummary />
      </Form>,
    );

    expect(
      screen.getByText('The request could not be completed.'),
    ).toBeTruthy();

    expect(screen.queryByRole('link')).toBeNull();
  });

  it('supports multiple messages for one field', () => {
    render(
      <Form
        validationErrors={{
          email: ['Email is required.', 'Email is invalid.'],
        }}
      >
        <FormErrorSummary />
      </Form>,
    );

    expect(
      screen.getByText('Email is required. Email is invalid.'),
    ).toBeTruthy();
  });

  it('supports explicit errors independently of Form context', () => {
    render(
      <FormErrorSummary
        errors={{ username: 'Username is already taken.' }}
        title="Please review the form"
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Please review the form' }),
    ).toBeTruthy();

    expect(screen.getByText('Username is already taken.')).toBeTruthy();
  });

  it('supports a description', () => {
    render(
      <FormErrorSummary
        errors={{ email: 'Enter a valid email address.' }}
        description="Correct the following fields and try again."
      />,
    );

    expect(
      screen.getByText('Correct the following fields and try again.'),
    ).toBeTruthy();
  });

  it('focuses the summary when focusOnMount is enabled', () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');

    render(
      <FormErrorSummary
        errors={{ email: 'Enter a valid email address.' }}
        focusOnMount
      />,
    );

    expect(focus).toHaveBeenCalled();

    focus.mockRestore();
  });

  it('supports custom classes and HTML attributes', () => {
    render(
      <FormErrorSummary
        errors={{ email: 'Enter a valid email address.' }}
        className="custom-summary"
        data-testid="error-summary"
      />,
    );

    expect(screen.getByTestId('error-summary').className).toContain(
      'custom-summary',
    );
  });

  it('links custom control IDs through fieldIds', () => {
    render(
      <Form validationErrors={{ email: 'Enter a valid email address.' }}>
        <FormErrorSummary
          fieldIds={{
            email: 'student-email',
          }}
        />

        <FormField name="email" label="Email address" controlId="student-email">
          <Input />
        </FormField>
      </Form>,
    );

    expect(
      screen
        .getByRole('link', {
          name: 'Enter a valid email address.',
        })
        .getAttribute('href'),
    ).toBe('#student-email');

    expect(screen.getByLabelText('Email address').id).toBe('student-email');
  });
});
