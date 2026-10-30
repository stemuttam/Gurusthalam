import { randomUUID } from 'node:crypto';

/**
 * Opaque identifier for an Assessment aggregate.
 *
 * AssessmentId represents the identity of an actual Assessment domain
 * entity. It is intentionally distinct from CourseStructure's
 * AssessmentReferenceId.
 *
 * Persistence-specific identifier representations must not leak into
 * the Assessment domain.
 */
export class AssessmentId {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;

    Object.freeze(this);
  }

  /**
   * Generates a new Assessment identifier.
   */
  static generate(): AssessmentId {
    return new AssessmentId(randomUUID());
  }

  /**
   * Rehydrates an existing Assessment identifier.
   *
   * Assessment identifiers are opaque canonical strings. UUID syntax
   * is used for generated identifiers but is not required for existing
   * persisted identifiers.
   */
  static from(value: string): AssessmentId {
    if (typeof value !== 'string' || value.length === 0) {
      throw new TypeError('AssessmentId must be a non-empty string.');
    }

    if (value.trim().length === 0) {
      throw new TypeError('AssessmentId must be a non-empty string.');
    }

    if (value.trim() !== value) {
      throw new TypeError(
        'AssessmentId must not contain leading or trailing whitespace.',
      );
    }

    return new AssessmentId(value);
  }

  /**
   * Determines whether a primitive value can represent an AssessmentId.
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
   * Compares Assessment identifiers by their primitive values.
   */
  equals(other: AssessmentId): boolean {
    return other instanceof AssessmentId && this.value === other.value;
  }
}
