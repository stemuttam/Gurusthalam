export function unique<T>(
  values: readonly T[],
): T[] {
  return [...new Set(values)];
}

export function chunk<T>(
  values: readonly T[],
  size: number,
): T[][] {
  if (size <= 0) {
    throw new Error('Chunk size must be greater than zero.');
  }

  const result: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    result.push([...values.slice(index, index + size)]);
  }

  return result;
}