import { z } from 'zod';

import {
  CourseValidationError,
  type CourseValidationIssue,
} from '../../domain/errors/index.js';

/**
 * Options used when converting a Zod validation failure into the
 * canonical CourseValidationError contract.
 */
export interface CourseApplicationValidationOptions {
  /**
   * Stable human-readable message describing the validation boundary.
   */
  readonly message: string;

  /**
   * Field name used when Zod reports a root-level issue without a path.
   *
   * Query validation historically exposes `query` for root-level issues,
   * therefore callers may override this value to preserve an established
   * contract.
   *
   * The default is `input`.
   */
  readonly rootField?: string;

  /**
   * Optional compatibility-aware resolver for the top-level validation
   * message.
   *
   * The canonical issue list is always preserved. This resolver only allows
   * an application boundary to retain an established semantic error message
   * when a particular validation failure has historically exposed one.
   *
   * If the resolver is not provided, `message` is used unchanged.
   */
  readonly messageResolver?: (
    issues: readonly CourseValidationIssue[],
  ) => string;
}

/**
 * Parses an application-bound input using its canonical Zod schema and
 * converts Zod validation failures into the framework-independent
 * CourseValidationError contract.
 *
 * Architectural boundary:
 *
 *   Zod
 *      ↓
 *   CourseValidationError
 *      ↓
 *   application/domain consumers
 *
 * This helper deliberately lives in the Course application layer rather
 * than the domain layer so the domain remains completely independent of
 * Zod.
 *
 * Non-Zod exceptions are never translated here. They propagate unchanged.
 */
export function parseCourseApplicationInput<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
  options: CourseApplicationValidationOptions,
): z.output<TSchema> {
  const result = schema.safeParse(input);

  if (result.success) {
    return result.data;
  }

  const rootField = options.rootField ?? 'input';

  const issues: readonly CourseValidationIssue[] = result.error.issues.map(
    (issue) => ({
      field: issue.path.length > 0 ? issue.path.join('.') : rootField,
      message: issue.message,
    }),
  );

  const message = options.messageResolver?.(issues) ?? options.message;

  throw new CourseValidationError(message, issues, {
    cause: result.error,
  });
}
