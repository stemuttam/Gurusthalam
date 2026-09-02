/**
 * Opaque identity for a CourseVersion aggregate/entity.
 *
 * Persistence-specific identifier implementations must not leak into
 * the Course domain.
 */
export class CourseVersionId {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
    Object.freeze(this);
  }

  static generate(): CourseVersionId {
    return new CourseVersionId(crypto.randomUUID());
  }

  static from(value: string): CourseVersionId {
    if (!CourseVersionId.isValid(value)) {
      throw new TypeError('CourseVersionId must be a non-empty string.');
    }

    return new CourseVersionId(value);
  }

  static isValid(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }

  toString(): string {
    return this.value;
  }

  equals(other: CourseVersionId): boolean {
    return this.value === other.value;
  }
}