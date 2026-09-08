/**
 * Dimensions describing different aspects of course difficulty.
 *
 * These are discovery signals rather than learner mastery measurements.
 * Mastery, prediction, and knowledge-tracing data belong to future learning
 * intelligence bounded contexts.
 */
export type DifficultyDimension =
  | 'conceptual'
  | 'pace'
  | 'workload'
  | 'prerequisite';

export type DifficultySignalStrength = 'low' | 'moderate' | 'high';

export interface CourseDifficultySignal {
  readonly dimension: DifficultyDimension;
  readonly strength: DifficultySignalStrength;
}

export interface CourseDifficultySignals {
  readonly signals: readonly CourseDifficultySignal[];
}

const VALID_DIFFICULTY_DIMENSIONS: ReadonlySet<string> = new Set([
  'conceptual',
  'pace',
  'workload',
  'prerequisite',
]);

const VALID_DIFFICULTY_STRENGTHS: ReadonlySet<string> = new Set([
  'low',
  'moderate',
  'high',
]);

/**
 * Creates a detached, immutable difficulty signal.
 */
export function createCourseDifficultySignal(
  input: CourseDifficultySignal,
): CourseDifficultySignal {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('CourseDifficultySignal input must be an object.');
  }

  if (!VALID_DIFFICULTY_DIMENSIONS.has(input.dimension)) {
    throw new TypeError(
      `Unsupported difficulty dimension: ${String(input.dimension)}.`,
    );
  }

  if (!VALID_DIFFICULTY_STRENGTHS.has(input.strength)) {
    throw new TypeError(
      `Unsupported difficulty signal strength: ${String(input.strength)}.`,
    );
  }

  return Object.freeze({
    dimension: input.dimension,
    strength: input.strength,
  });
}

/**
 * Creates a detached, immutable difficulty-signal collection.
 *
 * Each difficulty dimension is represented at most once so downstream
 * indexing and analytics have deterministic semantics.
 */
export function createCourseDifficultySignals(
  input: CourseDifficultySignals,
): CourseDifficultySignals {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('CourseDifficultySignals input must be an object.');
  }

  if (!Array.isArray(input.signals)) {
    throw new TypeError(
      'CourseDifficultySignals.signals must be an array of difficulty signals.',
    );
  }

  const signals = input.signals.map(createCourseDifficultySignal);
  const dimensions = new Set<DifficultyDimension>();

  for (const signal of signals) {
    if (dimensions.has(signal.dimension)) {
      throw new TypeError(
        `Duplicate difficulty dimension: ${signal.dimension}.`,
      );
    }

    dimensions.add(signal.dimension);
  }

  return Object.freeze({
    signals: Object.freeze(signals),
  });
}
