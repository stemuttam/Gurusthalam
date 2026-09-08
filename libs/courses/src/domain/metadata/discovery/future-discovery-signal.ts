export interface FutureDiscoverySignal {
  readonly key: string;
  readonly values: readonly string[];
}

/**
 * Creates a detached, immutable extension signal.
 *
 * Future signals provide an additive escape hatch for discovery semantics
 * that are not yet mature enough to deserve first-class domain types. They
 * remain plain domain data and intentionally contain no model, embedding,
 * ranking, or provider metadata.
 */
export function createFutureDiscoverySignal(
  input: FutureDiscoverySignal,
): FutureDiscoverySignal {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('FutureDiscoverySignal input must be an object.');
  }

  if (!isValidDiscoverySignalKey(input.key)) {
    throw new TypeError(
      'FutureDiscoverySignal.key must be a non-empty namespaced key without leading or trailing whitespace.',
    );
  }

  if (!Array.isArray(input.values)) {
    throw new TypeError(
      'FutureDiscoverySignal.values must be an array of strings.',
    );
  }

  const values = input.values.map((value) => {
    if (!isValidDiscoverySignalValue(value)) {
      throw new TypeError(
        'FutureDiscoverySignal.values must contain non-empty strings without leading or trailing whitespace.',
      );
    }

    return value;
  });

  return Object.freeze({
    key: input.key,
    values: Object.freeze(values),
  });
}

/**
 * Validates the extension-safe discovery signal namespace.
 *
 * Keys are intentionally conservative: lowercase segments separated by
 * `.`, `-`, or `_`. This keeps serialization, indexing, analytics, and future
 * feature extraction deterministic across systems.
 */
export function isValidDiscoverySignalKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.trim().length > 0 &&
    value.trim() === value &&
    /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/.test(value)
  );
}

/**
 * Validates an extension signal value without imposing a domain-specific
 * vocabulary.
 */
export function isValidDiscoverySignalValue(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.trim().length > 0 &&
    value.trim() === value
  );
}
