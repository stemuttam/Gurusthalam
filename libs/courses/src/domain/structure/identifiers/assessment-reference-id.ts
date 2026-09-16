/**
 * Opaque identifier for a structural Assessment reference.
 *
 * This identity belongs to the Course Structure layer.
 *
 * It intentionally does NOT represent the eventual Assessment domain model.
 * Assessment behavior and assessment implementations remain outside the
 * initial Course Structure identity layer.
 */
export class AssessmentReferenceId {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;

    Object.freeze(this);
  }

  /**
   * Creates a new AssessmentReferenceId.
   */
  static generate(): AssessmentReferenceId {
    return new AssessmentReferenceId(crypto.randomUUID());
  }

  /**
   * Rehydrates an existing AssessmentReferenceId.
   */
  static from(value: string): AssessmentReferenceId {
    if (typeof value !== 'string' || value.length === 0) {
      throw new TypeError('AssessmentReferenceId must be a non-empty string.');
    }

    if (value.trim().length === 0) {
      throw new TypeError('AssessmentReferenceId must be a non-empty string.');
    }

    if (value.trim() !== value) {
      throw new TypeError(
        'AssessmentReferenceId must not contain leading or trailing whitespace.',
      );
    }

    return new AssessmentReferenceId(value);
  }

  /**
   * Determines whether a primitive value can represent a valid
   * AssessmentReferenceId.
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
   * Compares identifiers by their primitive values.
   */
  equals(other: AssessmentReferenceId): boolean {
    return other instanceof AssessmentReferenceId && this.value === other.value;
  }
}
