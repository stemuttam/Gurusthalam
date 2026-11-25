// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Select } from './Select.js';

describe('Select', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a labelled select with its options', () => {
    render(
      <Select label="Course level" defaultValue="">
        <option value="">Choose a level</option>
        <option value="beginner">Beginner</option>
        <option value="advanced">Advanced</option>
      </Select>,
    );

    expect(screen.getByRole('combobox', { name: 'Course level' })).toBeTruthy();

    expect(screen.getByRole('option', { name: 'Beginner' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Advanced' })).toBeTruthy();
  });

  it('supports controlled values and change handlers', () => {
    let currentValue = 'beginner';

    const { rerender } = render(
      <Select
        label="Level"
        value={currentValue}
        onChange={(event) => {
          currentValue = event.target.value;
        }}
      >
        <option value="beginner">Beginner</option>
        <option value="advanced">Advanced</option>
      </Select>,
    );

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'advanced' },
    });

    expect(currentValue).toBe('advanced');

    rerender(
      <Select
        label="Level"
        value={currentValue}
        onChange={(event) => {
          currentValue = event.target.value;
        }}
      >
        <option value="beginner">Beginner</option>
        <option value="advanced">Advanced</option>
      </Select>,
    );

    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe(
      'advanced',
    );
  });

  it('supports uncontrolled default values', () => {
    render(
      <Select label="Status" defaultValue="active">
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </Select>,
    );

    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe(
      'active',
    );
  });

  it('supports grouped options', () => {
    render(
      <Select label="Subject">
        <optgroup label="Science">
          <option value="physics">Physics</option>
          <option value="chemistry">Chemistry</option>
        </optgroup>
      </Select>,
    );

    expect(screen.getByRole('group', { name: 'Science' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Physics' })).toBeTruthy();
  });

  it('associates helper text with the select', () => {
    render(
      <Select label="Class" helperText="Choose your current class.">
        <option value="8">Class 8</option>
        <option value="9">Class 9</option>
      </Select>,
    );

    const select = screen.getByRole('combobox');
    const helper = screen.getByText('Choose your current class.');

    expect(select.getAttribute('aria-describedby')).toContain(helper.id);
  });

  it('renders accessible validation errors', () => {
    render(
      <Select label="Class" errorMessage="Please select a class.">
        <option value="">Choose</option>
        <option value="8">Class 8</option>
      </Select>,
    );

    const select = screen.getByRole('combobox');
    const error = screen.getByText('Please select a class.');

    expect(select.getAttribute('aria-invalid')).toBe('true');
    expect(select.getAttribute('aria-describedby')).toContain(error.id);
  });

  it('supports required and disabled states', () => {
    render(
      <Select label="Board" required disabled>
        <option value="cbse">CBSE</option>
      </Select>,
    );

    const select = screen.getByRole('combobox');

    expect(select.hasAttribute('required')).toBe(true);
    expect(select.hasAttribute('disabled')).toBe(true);
  });

  it('supports custom ids and class names', () => {
    render(
      <Select
        id="institution-board"
        label="Board"
        className="custom-select"
        fieldClassName="custom-field"
      >
        <option value="cbse">CBSE</option>
      </Select>,
    );

    const select = screen.getByRole('combobox');

    expect(select.id).toBe('institution-board');
    expect(select.className).toContain('gt-select');
    expect(select.className).toContain('custom-select');
    expect(select.parentElement?.className).toContain('custom-field');
  });

  it('supports refs', () => {
    const ref = { current: null as HTMLSelectElement | null };

    render(
      <Select ref={ref} label="Board">
        <option value="cbse">CBSE</option>
      </Select>,
    );

    expect(ref.current).toBeInstanceOf(HTMLSelectElement);
  });

  it('preserves a supplied aria-errormessage', () => {
    render(
      <Select label="Course" aria-errormessage="external-course-error">
        <option value="science">Science</option>
      </Select>,
    );

    expect(screen.getByRole('combobox').getAttribute('aria-errormessage')).toBe(
      'external-course-error',
    );
  });
});
