/**
 * Strongly typed reference to a taxonomy Subject.
 *
 * Subject identity is intentionally independent from Category and
 * Subcategory identity.
 */
export class SubjectReference {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;

    Object.freeze(this);
  }

  /**
   * Creates a SubjectReference from a canonical identifier.
   */
  static from(value: string): SubjectReference {
    if (!SubjectReference.isValid(value)) {
      throw new TypeError(
        'SubjectReference must be a non-empty string without leading or trailing whitespace.',
      );
    }

    return new SubjectReference(value);
  }

  /**
   * Determines whether a primitive value can represent a valid
   * SubjectReference.
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
   * Returns the primitive taxonomy identifier.
   */
  toString(): string {
    return this.value;
  }

  /**
   * Compares SubjectReference instances by their primitive value.
   */
  equals(other: SubjectReference): boolean {
    return other instanceof SubjectReference && this.value === other.value;
  }
}
