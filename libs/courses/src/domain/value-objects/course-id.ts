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
   * This is intended for persistence/application layers when reconstructing
   * an aggregate from storage.
   */
  static from(value: string): CourseId {
    if (!CourseId.isValid(value)) {
      throw new TypeError('CourseId must be a non-empty string.');
    }

    return new CourseId(value);
  }

  static isValid(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }

  toString(): string {
    return this.value;
  }

  equals(other: CourseId): boolean {
    return this.value === other.value;
  }
}