// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Button } from '../buttons/Button.js';
import { Input } from './Input.js';
import { Form } from './Form.js';
import { FormActions } from './FormActions.js';
import { FormField } from './FormField.js';
import { FormSection } from './FormSection.js';
import { Select } from './Select.js';
import { Textarea } from './Textarea.js';

describe('Form composition', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a semantic form', () => {
    render(
      <Form aria-label="Create course">
        <button type="submit">Save</button>
      </Form>,
    );

    expect(screen.getByRole('form', { name: 'Create course' })).toBeTruthy();
  });

  it('forwards native form attributes', () => {
    render(
      <Form
        aria-label="Course form"
        method="post"
        autoComplete="off"
        data-testid="course-form"
      >
        <button type="submit">Save</button>
      </Form>,
    );

    const form = screen.getByTestId('course-form');

    expect(form.getAttribute('method')).toBe('post');
    expect(form.getAttribute('autocomplete')).toBe('off');
  });

  it('supports native submit events', () => {
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
    });

    render(
      <Form aria-label="Course form" onSubmit={onSubmit}>
        <button type="submit">Save</button>
      </Form>,
    );

    fireEvent.submit(screen.getByRole('form', { name: 'Course form' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('supports native reset events', () => {
    const onReset = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
    });

    render(
      <Form aria-label="Course form" onReset={onReset}>
        <button type="reset">Reset</button>
      </Form>,
    );

    fireEvent.reset(screen.getByRole('form', { name: 'Course form' }));

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('supports native noValidate configuration', () => {
    render(
      <Form aria-label="Course form" noValidate>
        <button type="submit">Save</button>
      </Form>,
    );

    expect(
      (screen.getByRole('form', { name: 'Course form' }) as HTMLFormElement)
        .noValidate,
    ).toBe(true);
  });

  it('forwards its ref to the native form', () => {
    const ref = { current: null as HTMLFormElement | null };

    render(
      <Form ref={ref}>
        <button type="submit">Save</button>
      </Form>,
    );

    expect(ref.current).toBeInstanceOf(HTMLFormElement);
  });

  it('renders an accessible FormField label', () => {
    render(
      <FormField label="Course name">
        <Input />
      </FormField>,
    );

    expect(screen.getByRole('textbox', { name: 'Course name' })).toBeTruthy();
  });

  it('associates a supplied control ID with the label', () => {
    render(
      <FormField label="Course name" controlId="course-name">
        <Input />
      </FormField>,
    );

    expect(screen.getByLabelText('Course name').id).toBe('course-name');
  });

  it('generates a control ID when one is not supplied', () => {
    render(
      <FormField label="Course name">
        <Input />
      </FormField>,
    );

    const input = screen.getByRole('textbox', { name: 'Course name' });

    expect(input.id).toContain('gt-form-control-');
  });

  it('associates descriptions with the control', () => {
    render(
      <FormField
        label="Course name"
        description="Use the official course title."
      >
        <Input />
      </FormField>,
    );

    const input = screen.getByRole('textbox', { name: 'Course name' });
    const description = screen.getByText('Use the official course title.');

    expect(input.getAttribute('aria-describedby')).toContain(description.id);
  });

  it('associates validation errors and marks the control invalid', () => {
    render(
      <FormField label="Course name" error="A course name is required.">
        <Input />
      </FormField>,
    );

    const input = screen.getByRole('textbox', { name: 'Course name' });
    const error = screen.getByText('A course name is required.');

    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toContain(error.id);
    expect(input.getAttribute('aria-errormessage')).toBe(error.id);
    expect(error.id).toBe(`${input.id}-form-error`);

    // Inline field errors are associated with the control.
    // FormErrorSummary owns the form-level live announcement.
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('supports a description and error simultaneously', () => {
    render(
      <FormField
        label="Course name"
        description="Use the official course title."
        error="The course name is already in use."
      >
        <Input />
      </FormField>,
    );

    const input = screen.getByRole('textbox', { name: 'Course name' });
    const description = screen.getByText('Use the official course title.');
    const error = screen.getByText('The course name is already in use.');

    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toContain(description.id);
    expect(input.getAttribute('aria-describedby')).toContain(error.id);
    expect(input.getAttribute('aria-errormessage')).toBe(error.id);
    expect(error.id).toBe(`${input.id}-form-error`);

    // Description and validation text are both associated with the control.
    // The inline error does not create a second live announcement.
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('communicates required state to the native input', () => {
    render(
      <FormField label="Email" required>
        <Input type="email" />
      </FormField>,
    );

    const input = screen.getByRole('textbox', { name: 'Email' });

    expect((input as HTMLInputElement).required).toBe(true);
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  it('communicates disabled state to the native input', () => {
    render(
      <FormField label="Email" disabled>
        <Input />
      </FormField>,
    );

    expect(
      (screen.getByRole('textbox', { name: 'Email' }) as HTMLInputElement)
        .disabled,
    ).toBe(true);
  });

  it('preserves explicit control required and disabled overrides', () => {
    render(
      <FormField label="Email" required disabled>
        <Input required={false} disabled={false} />
      </FormField>,
    );

    const input = screen.getByRole('textbox', { name: 'Email' });

    expect((input as HTMLInputElement).required).toBe(false);
    expect((input as HTMLInputElement).disabled).toBe(false);
  });

  it('supports Select inside FormField', () => {
    render(
      <FormField label="Course level" required>
        <Select>
          <option value="">Choose a level</option>
          <option value="beginner">Beginner</option>
        </Select>
      </FormField>,
    );

    const select = screen.getByRole('combobox', {
      name: 'Course level',
    });

    expect((select as HTMLSelectElement).required).toBe(true);
    expect(select.id).toContain('gt-form-control-');
  });

  it('supports Textarea inside FormField', () => {
    render(
      <FormField
        label="Description"
        description="Describe the course."
        error="A description is required."
      >
        <Textarea />
      </FormField>,
    );

    const textarea = screen.getByRole('textbox', {
      name: 'Description',
    });

    expect(textarea.getAttribute('aria-invalid')).toBe('true');
    expect(textarea.getAttribute('aria-describedby')).toContain('description');
  });

  it('supports the optional field indicator', () => {
    render(
      <FormField label="Middle name" optional>
        <Input />
      </FormField>,
    );

    expect(screen.getByText('Optional')).toBeTruthy();
  });

  it('supports a custom optional indicator', () => {
    render(
      <FormField label="Middle name" optional optionalLabel="Not required">
        <Input />
      </FormField>,
    );

    expect(screen.getByText('Not required')).toBeTruthy();
  });

  it('renders a semantic fieldset with a legend', () => {
    render(
      <FormSection legend="Course details">
        <FormField label="Course name">
          <Input />
        </FormField>
      </FormSection>,
    );

    expect(screen.getByRole('group', { name: 'Course details' })).toBeTruthy();
  });

  it('associates a section description with its fieldset', () => {
    render(
      <FormSection
        legend="Course details"
        description="Provide the basic course information."
      >
        <FormField label="Course name">
          <Input />
        </FormField>
      </FormSection>,
    );

    const group = screen.getByRole('group', { name: 'Course details' });
    const description = screen.getByText(
      'Provide the basic course information.',
    );

    expect(group.getAttribute('aria-describedby')).toContain(description.id);
  });

  it('supports disabled sections', () => {
    render(
      <FormSection legend="Course details" disabled>
        <FormField label="Course name">
          <Input />
        </FormField>
      </FormSection>,
    );

    expect(
      screen
        .getByRole('textbox', {
          name: 'Course name',
        })
        .matches(':disabled'),
    ).toBe(true);
  });

  it('supports nested form sections', () => {
    render(
      <FormSection legend="Course">
        <FormSection legend="Basic information">
          <FormField label="Course name">
            <Input />
          </FormField>
        </FormSection>
      </FormSection>,
    );

    expect(screen.getByRole('group', { name: 'Course' })).toBeTruthy();

    expect(
      screen.getByRole('group', { name: 'Basic information' }),
    ).toBeTruthy();
  });

  it('renders composable form actions', () => {
    render(
      <FormActions>
        <Button type="button">Cancel</Button>
        <Button type="submit">Save</Button>
      </FormActions>,
    );

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });

  it('supports action alignment and justification', () => {
    const { container } = render(
      <FormActions align="stretch" justify="between" data-testid="actions">
        <button type="button">Cancel</button>
        <button type="submit">Save</button>
      </FormActions>,
    );

    const actions = container.querySelector('[data-testid="actions"]');

    expect(actions?.className).toContain('gt-form-actions--align-stretch');
    expect(actions?.className).toContain('gt-form-actions--justify-between');
  });

  it('allows disabling mobile stacking', () => {
    const { container } = render(
      <FormActions stackOnMobile={false} data-testid="actions">
        <button type="button">Cancel</button>
      </FormActions>,
    );

    expect(
      container
        .querySelector('[data-testid="actions"]')
        ?.className.includes('gt-form-actions--stack-mobile'),
    ).toBe(false);
  });

  it('preserves custom classes and HTML attributes', () => {
    const { container } = render(
      <FormActions
        className="custom-actions"
        data-testid="actions"
        aria-label="Form actions"
      >
        <button type="submit">Save</button>
      </FormActions>,
    );

    const actions = container.querySelector('[data-testid="actions"]');

    expect(actions?.className).toContain('custom-actions');
    expect(actions?.getAttribute('aria-label')).toBe('Form actions');
  });

  it('does not create a duplicate live alert for a FormField error', () => {
    render(
      <Form>
        <FormField label="Course name" error="A course name is required.">
          <Input />
        </FormField>
      </Form>,
    );

    expect(screen.queryAllByRole('alert')).toHaveLength(0);
    expect(screen.getByText('A course name is required.')).toBeTruthy();
  });
});
