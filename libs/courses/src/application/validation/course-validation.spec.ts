import { describe, expect, it } from 'vitest';

import { z } from 'zod';

import {
  CourseDomainErrorCode,
  CourseValidationError,
} from '../../domain/errors/index.js';

import { parseCourseApplicationInput } from './course-validation.js';

describe('Course application validation adapter', () => {
  it('returns validated Zod output for valid input', () => {
    const schema = z.object({
      page: z.coerce.number().int().min(1),
    });

    const result = parseCourseApplicationInput(
      schema,
      {
        page: '2',
      },
      {
        message: 'Invalid input.',
      },
    );

    expect(result).toEqual({
      page: 2,
    });
  });

  it('converts Zod failures into CourseValidationError', () => {
    const schema = z.object({
      title: z.string().min(1),
    });

    expect(() =>
      parseCourseApplicationInput(
        schema,
        {
          title: '',
        },
        {
          message: 'Invalid Course input.',
        },
      ),
    ).toThrow(CourseValidationError);
  });

  it('preserves the canonical Course validation error code', () => {
    const schema = z.object({
      title: z.string().min(1),
    });

    try {
      parseCourseApplicationInput(
        schema,
        {
          title: '',
        },
        {
          message: 'Invalid Course input.',
        },
      );

      throw new Error(
        'Expected CourseValidationError.',
      );
    } catch (error) {
      expect(error).toBeInstanceOf(
        CourseValidationError,
      );

      const validationError =
        error as CourseValidationError;

      expect(validationError.code).toBe(
        CourseDomainErrorCode.VALIDATION_ERROR,
      );
    }
  });

  it('maps nested Zod paths to stable dotted field names', () => {
    const schema = z.object({
      ownership: z.array(
        z.object({
          principalId: z.string().min(1),
        }),
      ),
    });

    try {
      parseCourseApplicationInput(
        schema,
        {
          ownership: [
            {
              principalId: '',
            },
          ],
        },
        {
          message: 'Invalid Course input.',
        },
      );

      throw new Error(
        'Expected CourseValidationError.',
      );
    } catch (error) {
      expect(error).toBeInstanceOf(
        CourseValidationError,
      );

      const validationError =
        error as CourseValidationError;

      expect(validationError.issues).toEqual([
        {
          field: 'ownership.0.principalId',
          message: 'Too small: expected string to have >=1 characters',
        },
      ]);
    }
  });

  it('uses the supplied root field for root-level validation failures', () => {
    const schema = z
      .object({
        title: z.string(),
      })
      .refine(
        (input) => input.title === 'valid',
        {
          message: 'Course input is semantically invalid.',
        },
      );

    try {
      parseCourseApplicationInput(
        schema,
        {
          title: 'invalid',
        },
        {
          message: 'Invalid Course input.',
          rootField: 'course',
        },
      );

      throw new Error(
        'Expected CourseValidationError.',
      );
    } catch (error) {
      expect(error).toBeInstanceOf(
        CourseValidationError,
      );

      expect(
        (error as CourseValidationError).issues,
      ).toEqual([
        {
          field: 'course',
          message:
            'Course input is semantically invalid.',
        },
      ]);
    }
  });

  it('preserves the original ZodError as the error cause', () => {
    const schema = z.object({
      title: z.string().min(1),
    });

    try {
      parseCourseApplicationInput(
        schema,
        {
          title: '',
        },
        {
          message: 'Invalid Course input.',
        },
      );

      throw new Error(
        'Expected CourseValidationError.',
      );
    } catch (error) {
      expect(error).toBeInstanceOf(
        CourseValidationError,
      );

      const validationError =
        error as CourseValidationError;

      expect(validationError.cause).toBeInstanceOf(
        z.ZodError,
      );
    }
  });

  it('does not expose mutable issue objects', () => {
    const schema = z.object({
      title: z.string().min(1),
    });

    try {
      parseCourseApplicationInput(
        schema,
        {
          title: '',
        },
        {
          message: 'Invalid Course input.',
        },
      );

      throw new Error(
        'Expected CourseValidationError.',
      );
    } catch (error) {
      expect(error).toBeInstanceOf(
        CourseValidationError,
      );

      const validationError =
        error as CourseValidationError;

      expect(
        Object.isFrozen(validationError.issues),
      ).toBe(true);

      expect(
        Object.isFrozen(validationError.issues[0]),
      ).toBe(true);
    }
  });
});