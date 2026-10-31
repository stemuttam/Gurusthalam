import { randomUUID } from 'node:crypto';

/**
 * Opaque identifier for a Question domain entity.
 *
 * QuestionId identifies a Question owned by the Question Bank bounded
 * context. It is intentionally distinct from identifiers belonging to
 * Assessment, Course Structure, Quiz, Attempt, Answer, and other domains.
 *
 * Generated identifiers use UUIDs. Existing persisted identifiers remain
 * opaque canonical strings and are not required to use UUID syntax.
 *
 * Persistence-specific identifier representations must not leak into
 * the Question Bank domain.
 */
export class QuestionId {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;

    Object.freeze(this);
  }

  /**
   * Generates a new Question identifier.
   */
  static generate(): QuestionId {
    return new QuestionId(randomUUID());
  }

  /**
   * Rehydrates an existing Question identifier.
   *
   * The supplied value is preserved exactly. It is not trimmed,
   * normalized, or restricted to UUID syntax.
   */
  static from(value: string): QuestionId {
    if (typeof value !== 'string' || value.length === 0) {
      throw new TypeError('QuestionId must be a non-empty string.');
    }

    if (value.trim().length === 0) {
      throw new TypeError('QuestionId must be a non-empty string.');
    }

    if (value.trim() !== value) {
      throw new TypeError(
        'QuestionId must not contain leading or trailing whitespace.',
      );
    }

    return new QuestionId(value);
  }

  /**
   * Determines whether a primitive value can represent a QuestionId.
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
   * Compares Question identifiers by their primitive values.
   */
  equals(other: QuestionId): boolean {
    return other instanceof QuestionId && this.value === other.value;
  }
}
