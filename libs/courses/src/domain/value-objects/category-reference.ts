/**
 * Strongly typed reference to a taxonomy Category.
 *
 * The Course domain intentionally treats the underlying identifier as
 * opaque. Persistence-specific identifier implementations must not leak
 * into the domain.
 */
export class CategoryReference {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;

    Object.freeze(this);
  }

  /**
   * Creates a CategoryReference from a canonical identifier.
   *
   * Leading/trailing whitespace is rejected rather than silently
   * normalized so domain identity cannot change implicitly.
   */
  static from(value: string): CategoryReference {
    if (!CategoryReference.isValid(value)) {
      throw new TypeError(
        'CategoryReference must be a non-empty string without leading or trailing whitespace.',
      );
    }

    return new CategoryReference(value);
  }

  /**
   * Determines whether a primitive value can represent a valid
   * CategoryReference.
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
   * Compares CategoryReference instances by their primitive value.
   */
  equals(other: CategoryReference): boolean {
    return other instanceof CategoryReference && this.value === other.value;
  }
}
