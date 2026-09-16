/**
 * Opaque reference to a person/user participating in a Course context.
 *
 * The Course domain does not own the identity lifecycle represented by this
 * identifier. The actual User / Instructor Profile belongs to the platform's
 * identity context.
 *
 * This value object exists only to prevent raw identity strings from being
 * confused with Course identifiers or other domain identifiers.
 */
export class CourseActorId {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;

    Object.freeze(this);
  }

  /**
   * Rehydrates an existing external actor identifier.
   *
   * The identifier remains opaque. No UUID assumption is imposed because
   * the identity service may use another stable identifier representation.
   */
  static from(value: string): CourseActorId {
    if (!CourseActorId.isValid(value)) {
      throw new TypeError(
        'CourseActorId must be a non-empty string without leading or trailing whitespace.',
      );
    }

    return new CourseActorId(value);
  }

  /**
   * Determines whether a primitive value can represent a valid CourseActorId.
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
   * Returns the primitive identifier.
   */
  toString(): string {
    return this.value;
  }

  /**
   * Compares actor identifiers by value.
   */
  equals(other: CourseActorId): boolean {
    return other instanceof CourseActorId && this.value === other.value;
  }
}
