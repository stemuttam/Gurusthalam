/**
 * A learner-facing statement describing an intended learning outcome.
 *
 * The objective remains deliberately structural rather than AI-specific.
 * Future semantic analysis can consume this stable contract without changing
 * the Course domain representation.
 */
export interface LearningObjective {
  readonly statement: string;
}

/**
 * Creates a detached, immutable LearningObjective.
 */
export function createLearningObjective(
  input: LearningObjective,
): LearningObjective {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('LearningObjective input must be an object.');
  }

  if (!isValidLearningObjectiveStatement(input.statement)) {
    throw new TypeError(
      'LearningObjective.statement must be a non-empty string without leading or trailing whitespace.',
    );
  }

  return Object.freeze({
    statement: input.statement,
  });
}

/**
 * Determines whether a primitive can represent a canonical objective
 * statement.
 */
export function isValidLearningObjectiveStatement(
  value: unknown,
): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.trim().length > 0 &&
    value.trim() === value
  );
}
