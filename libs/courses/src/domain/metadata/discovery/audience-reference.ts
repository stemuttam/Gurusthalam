/**
 * Strongly typed audience reference used by Course discovery metadata.
 *
 * The identifier remains opaque. Audience vocabulary is intentionally not
 * hard-coded here so future institutional, corporate, regional, or AI-derived
 * audience taxonomies can evolve independently of the Course domain.
 */
export class AudienceReference {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;

    Object.freeze(this);
  }

  /**
   * Creates an AudienceReference from a canonical opaque identifier.
   *
   * Surrounding whitespace is rejected rather than silently normalized so
   * identity cannot change implicitly at a domain boundary.
   */
  static from(value: string): AudienceReference {
    if (!AudienceReference.isValid(value)) {
      throw new TypeError(
        'AudienceReference must be a non-empty string without leading or trailing whitespace.',
      );
    }

    return new AudienceReference(value);
  }

  /**
   * Determines whether a primitive can represent an AudienceReference.
   */
  static isValid(value: unknown): value is string {
    return (
      typeof value === 'string' &&
      value.length > 0 &&
      value.trim().length > 0 &&
      value.trim() === value
    );
  }

  toString(): string {
    return this.value;
  }

  equals(other: AudienceReference): boolean {
    return other instanceof AudienceReference && this.value === other.value;
  }
}
