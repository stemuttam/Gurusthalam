/**
 * Opaque identifier for a Course aggregate.
 *
 * The Course domain intentionally treats the identifier as an opaque value.
 * Persistence-specific identifier types must not leak into the domain.
 */
export class CourseId {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;

    Object.freeze(this);
  }

  /**
   * Creates a new CourseId.
   *
   * `crypto.randomUUID()` is available in modern Node.js runtimes and keeps
   * identifier generation within the domain boundary without introducing
   * an infrastructure dependency.
   */
  static generate(): CourseId {
    return new CourseId(crypto.randomUUID());
  }

  /**
   * Rehydrates an existing CourseId.
   *
   * A persisted identifier must be a canonical value. Leading or trailing
   * whitespace is rejected rather than silently normalized.
   */
  static from(value: string): CourseId {
    if (typeof value !== 'string' || value.length === 0) {
      throw new TypeError('CourseId must be a non-empty string.');
    }

    if (value.trim().length === 0) {
      throw new TypeError('CourseId must be a non-empty string.');
    }

    if (value.trim() !== value) {
      throw new TypeError(
        'CourseId must not contain leading or trailing whitespace.',
      );
    }

    return new CourseId(value);
  }

  /**
   * Determines whether a primitive value can represent a valid CourseId.
   *
   * CourseId intentionally remains opaque and does not require UUID syntax.
   * UUIDs are the default generated format, while persisted identifiers may
   * use another stable string representation.
   */
  static isValid(value: unknown): value is string {
    return (
      typeof value === 'string' &&
      value.length > 0 &&
      value.trim().length > 0 &&
      value.trim() === value
    );
  }

  /**
   * Returns the primitive identifier value.
   */
  toString(): string {
    return this.value;
  }

  /**
   * Compares Course identifiers by their primitive value.
   *
   * Runtime-invalid values are treated as non-equal rather than causing
   * an exception.
   */
  equals(other: CourseId): boolean {
    return other instanceof CourseId && this.value === other.value;
  }
}