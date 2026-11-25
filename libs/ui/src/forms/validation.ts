import type {
  FormErrorValue,
  FormValidationErrors,
} from './FormValidationContext.js';

/**
 * Structural representation of a validation issue.
 *
 * Compatible with Zod-style validation issues without introducing
 * a direct dependency on Zod into the UI package.
 */
export interface ValidationIssueLike {
  path: readonly (string | number)[];
  message: string;
}

/**
 * Structural representation of a validation error.
 */
export interface ValidationErrorLike {
  issues: readonly ValidationIssueLike[];
}

/**
 * Structural representation of safeParse/safeValidate results.
 */
export interface SafeValidationResultLike {
  success: boolean;
  error?: ValidationErrorLike;
}

/**
 * Reserved key for errors that do not belong to a specific field.
 */
export const FORM_LEVEL_ERROR_KEY = '_form';

/**
 * Converts a validation path into a field key.
 *
 * Examples:
 * ['student', 'email'] -> 'student.email'
 * ['items', 0, 'name'] -> 'items.0.name'
 * [] -> '_form'
 */
function normalizePath(path: readonly (string | number)[]): string {
  if (path.length === 0) {
    return FORM_LEVEL_ERROR_KEY;
  }

  return path.map(String).join('.');
}

/**
 * Safely defines an own enumerable property, including keys that
 * normally exist on Object.prototype.
 */
function defineOwnProperty<T>(
  target: Record<string, T>,
  key: string,
  value: T,
): void {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    writable: true,
    value,
  });
}

/**
 * Converts validation issues into the field-error map consumed by Form.
 *
 * Features:
 * - Supports nested field paths.
 * - Maps root-level errors to FORM_LEVEL_ERROR_KEY.
 * - Ignores empty validation messages.
 * - Removes duplicate messages for the same field.
 * - Preserves multiple distinct messages in their original order.
 * - Safely handles special JavaScript object property names.
 */
export function validationIssuesToFormErrors(
  issues: readonly ValidationIssueLike[],
): FormValidationErrors {
  const result = new Map<string, string[]>();

  for (const issue of issues) {
    const message = issue.message.trim();

    if (message.length === 0) {
      continue;
    }

    const key = normalizePath(issue.path);
    let messages = result.get(key);

    if (messages === undefined) {
      messages = [];
      result.set(key, messages);
    }

    if (!messages.includes(message)) {
      messages.push(message);
    }
  }

  const normalized: Record<string, FormErrorValue> = {};

  for (const [key, messages] of result) {
    if (messages.length === 1) {
      const firstMessage = messages[0];

      if (firstMessage !== undefined) {
        defineOwnProperty(normalized, key, firstMessage);
      }

      continue;
    }

    if (messages.length > 1) {
      defineOwnProperty(normalized, key, messages);
    }
  }

  return normalized;
}

/**
 * Converts a Zod-compatible validation error into Form errors.
 */
export function validationErrorToFormErrors(
  error: ValidationErrorLike,
): FormValidationErrors {
  return validationIssuesToFormErrors(error.issues);
}

/**
 * Converts a safeParse/safeValidate-compatible result into Form errors.
 *
 * Successful results return an empty error map.
 * Failed results are converted from their validation issues.
 */
export function validationResultToFormErrors(
  result: SafeValidationResultLike,
): FormValidationErrors {
  if (result.success) {
    return {};
  }

  const validationError = result.error;

  if (validationError === undefined) {
    return {};
  }

  return validationErrorToFormErrors(validationError);
}
