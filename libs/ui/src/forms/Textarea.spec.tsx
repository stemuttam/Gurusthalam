// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Textarea } from './Textarea.js';

describe('Textarea', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a labelled textarea', () => {
    render(<Textarea label="Course description" />);

    expect(
      screen.getByRole('textbox', { name: 'Course description' }),
    ).toBeTruthy();
  });

  it('supports controlled values', () => {
    let currentValue = 'Initial description';

    const { rerender } = render(
      <Textarea
        label="Description"
        value={currentValue}
        onChange={(event) => {
          currentValue = event.target.value;
        }}
      />,
    );

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Updated description' },
    });

    expect(currentValue).toBe('Updated description');

    rerender(
      <Textarea
        label="Description"
        value={currentValue}
        onChange={(event) => {
          currentValue = event.target.value;
        }}
      />,
    );

    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      'Updated description',
    );
  });

  it('supports default values', () => {
    render(<Textarea label="Notes" defaultValue="Initial notes" />);

    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      'Initial notes',
    );
  });

  it('supports rows, columns and placeholder', () => {
    render(
      <Textarea
        label="Feedback"
        rows={5}
        cols={40}
        placeholder="Write your feedback"
      />,
    );

    const textarea = screen.getByRole('textbox');

    expect(textarea.getAttribute('rows')).toBe('5');
    expect(textarea.getAttribute('cols')).toBe('40');
    expect(textarea.getAttribute('placeholder')).toBe('Write your feedback');
  });

  it('associates helper text with the textarea', () => {
    render(<Textarea label="Summary" helperText="Keep the summary concise." />);

    const textarea = screen.getByRole('textbox');
    const helper = screen.getByText('Keep the summary concise.');

    expect(textarea.getAttribute('aria-describedby')).toContain(helper.id);
  });

  it('renders accessible validation errors', () => {
    render(<Textarea label="Answer" errorMessage="An answer is required." />);

    const textarea = screen.getByRole('textbox');
    const error = screen.getByText('An answer is required.');

    expect(textarea.getAttribute('aria-invalid')).toBe('true');
    expect(textarea.getAttribute('aria-describedby')).toContain(error.id);
  });

  it('supports required and disabled states', () => {
    render(<Textarea label="Instructions" required disabled />);

    const textarea = screen.getByRole('textbox');

    expect(textarea.hasAttribute('required')).toBe(true);
    expect(textarea.hasAttribute('disabled')).toBe(true);
  });

  it('supports custom ids and class names', () => {
    render(
      <Textarea
        id="course-summary"
        label="Summary"
        className="custom-textarea"
        fieldClassName="custom-field"
      />,
    );

    const textarea = screen.getByRole('textbox');

    expect(textarea.id).toBe('course-summary');
    expect(textarea.className).toContain('gt-textarea');
    expect(textarea.className).toContain('custom-textarea');
    expect(textarea.parentElement?.className).toContain('custom-field');
  });

  it('supports refs', () => {
    const ref = { current: null as HTMLTextAreaElement | null };

    render(<Textarea ref={ref} label="Notes" />);

    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });

  it('preserves a supplied aria-errormessage', () => {
    render(
      <Textarea
        label="Description"
        aria-errormessage="external-description-error"
      />,
    );

    expect(screen.getByRole('textbox').getAttribute('aria-errormessage')).toBe(
      'external-description-error',
    );
  });
});
