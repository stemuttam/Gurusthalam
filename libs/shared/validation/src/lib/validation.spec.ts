import {
  emailSchema,
  nonEmptyStringSchema,
} from './common.schemas.js';

import {
  paginationSchema,
} from './pagination.schemas.js';

import {
  safeValidate,
  validate,
} from './validation.js';

describe('Validation', () => {
  it('accepts a valid email', () => {
    expect(
      emailSchema.parse('student@gurusthalam.com'),
    ).toBe('student@gurusthalam.com');
  });

  it('rejects an invalid email', () => {
    expect(
      emailSchema.safeParse('invalid-email').success,
    ).toBe(false);
  });

  it('validates non-empty strings', () => {
    expect(
      validate(nonEmptyStringSchema, 'Gurusthalam'),
    ).toBe('Gurusthalam');
  });

  it('rejects empty strings', () => {
    expect(
      safeValidate(nonEmptyStringSchema, '   ').success,
    ).toBe(false);
  });

  it('applies pagination defaults', () => {
    expect(
      paginationSchema.parse({}),
    ).toEqual({
      page: 1,
      limit: 20,
      sortOrder: 'desc',
    });
  });

  it('rejects excessive page size', () => {
    expect(
      paginationSchema.safeParse({
        page: 1,
        limit: 101,
      }).success,
    ).toBe(false);
  });
});