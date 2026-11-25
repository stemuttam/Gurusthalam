import { describe, expect, it } from 'vitest';

import {
  FORM_LEVEL_ERROR_KEY,
  validationErrorToFormErrors,
  validationIssuesToFormErrors,
  validationResultToFormErrors,
} from './validation.js';

describe('form validation adapters', () => {
  it('maps a field issue to its dot-separated field path', () => {
    expect(
      validationIssuesToFormErrors([
        { path: ['student', 'email'], message: 'Enter a valid email.' },
      ]),
    ).toEqual({
      'student.email': 'Enter a valid email.',
    });
  });

  it('maps root-level issues to the form-level error key', () => {
    expect(
      validationIssuesToFormErrors([
        { path: [], message: 'The submission could not be accepted.' },
      ]),
    ).toEqual({
      [FORM_LEVEL_ERROR_KEY]: 'The submission could not be accepted.',
    });
  });

  it('retains multiple distinct errors for one field', () => {
    expect(
      validationIssuesToFormErrors([
        { path: ['email'], message: 'Email is required.' },
        { path: ['email'], message: 'Email must be valid.' },
        { path: ['email'], message: 'Email must be valid.' },
      ]),
    ).toEqual({
      email: ['Email is required.', 'Email must be valid.'],
    });
  });

  it('ignores empty validation messages', () => {
    expect(
      validationIssuesToFormErrors([{ path: ['email'], message: '  ' }]),
    ).toEqual({});
  });

  it('converts a validation error object', () => {
    expect(
      validationErrorToFormErrors({
        issues: [{ path: ['title'], message: 'Title is required.' }],
      }),
    ).toEqual({
      title: 'Title is required.',
    });
  });

  it('returns an empty error map for a successful validation result', () => {
    expect(
      validationResultToFormErrors({
        success: true,
      }),
    ).toEqual({});
  });

  it('safely handles special JavaScript object property names', () => {
    const errors = validationIssuesToFormErrors([
      { path: ['__proto__'], message: 'Invalid prototype field.' },
      { path: ['constructor'], message: 'Constructor field is required.' },
      { path: ['toString'], message: 'String field is required.' },
    ]);

    expect(errors['__proto__']).toBe('Invalid prototype field.');
    expect(errors['constructor']).toBe('Constructor field is required.');
    expect(errors['toString']).toBe('String field is required.');
    expect(Object.keys(errors)).toEqual([
      '__proto__',
      'constructor',
      'toString',
    ]);
  });

  it('preserves multiple errors for special property names', () => {
    const errors = validationIssuesToFormErrors([
      { path: ['__proto__'], message: 'First error.' },
      { path: ['__proto__'], message: 'Second error.' },
    ]);

    expect(errors['__proto__']).toEqual(['First error.', 'Second error.']);
  });

  it('converts a failed safe-validation result', () => {
    expect(
      validationResultToFormErrors({
        success: false,
        error: {
          issues: [{ path: ['title'], message: 'Title is required.' }],
        },
      }),
    ).toEqual({
      title: 'Title is required.',
    });
  });
});
