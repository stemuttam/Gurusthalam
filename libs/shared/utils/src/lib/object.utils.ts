export function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function omit<T extends Record<string, unknown>>(
  object: T,
  keys: readonly (keyof T)[],
): Partial<T> {
  const result = { ...object };

  for (const key of keys) {
    delete result[key];
  }

  return result;
}