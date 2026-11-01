import { randomUUID } from 'node:crypto';

/**
 * Opaque identifier for one immutable Question version.
 *
 * QuestionVersionId identifies a specific revision of a Question.
 * It is intentionally distinct from QuestionId, which identifies the
 * stable Question entity across all of its revisions.
 *
 * Generated identifiers use UUIDs. Existing persisted identifiers remain
 * opaque canonical strings and are not required to use UUID syntax.
 *
 * Version ordering is represented separately by QuestionVersionNumber.
 * The identifier itself carries no ordering semantics.
 */
export class QuestionVersionId {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;

    Object.freeze(this);
  }

  /**
   * Generates a new QuestionVersion identifier.
   */
  static generate(): QuestionVersionId {
    return new QuestionVersionId(randomUUID());
  }

  /**
   * Rehydrates an existing QuestionVersion identifier.
   *
   * The supplied value is preserved exactly. It is not trimmed,
   * normalized, or restricted to UUID syntax.
   */
  static from(value: string): QuestionVersionId {
    if (typeof value !== 'string' || value.length === 0) {
      throw new TypeError('QuestionVersionId must be a non-empty string.');
    }

    if (value.trim().length === 0) {
      throw new TypeError('QuestionVersionId must be a non-empty string.');
    }

    if (value.trim() !== value) {
      throw new TypeError(
        'QuestionVersionId must not contain leading or trailing whitespace.',
      );
    }

    return new QuestionVersionId(value);
  }

  /**
   * Determines whether a primitive value can represent a
   * QuestionVersionId.
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
   * Compares QuestionVersion identifiers by their primitive values.
   */
  equals(other: QuestionVersionId): boolean {
    return other instanceof QuestionVersionId && this.value === other.value;
  }
}
