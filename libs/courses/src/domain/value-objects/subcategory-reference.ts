/**
 * Strongly typed reference to a taxonomy Subcategory.
 *
 * The identifier is intentionally opaque to the Course domain.
 */
export class SubcategoryReference {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;

    Object.freeze(this);
  }

  /**
   * Creates a SubcategoryReference from a canonical identifier.
   */
  static from(value: string): SubcategoryReference {
    if (!SubcategoryReference.isValid(value)) {
      throw new TypeError(
        'SubcategoryReference must be a non-empty string without leading or trailing whitespace.',
      );
    }

    return new SubcategoryReference(value);
  }

  /**
   * Determines whether a primitive value can represent a valid
   * SubcategoryReference.
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
   * Compares SubcategoryReference instances by their primitive value.
   */
  equals(other: SubcategoryReference): boolean {
    return other instanceof SubcategoryReference && this.value === other.value;
  }
}
