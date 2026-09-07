/**
 * Strongly typed reference to a taxonomy Topic.
 *
 * Topic identity is intentionally distinct from Subject and Skill
 * identity even when the underlying persistence representation uses
 * strings for all of them.
 */
export class TopicReference {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;

    Object.freeze(this);
  }

  /**
   * Creates a TopicReference from a canonical identifier.
   */
  static from(value: string): TopicReference {
    if (!TopicReference.isValid(value)) {
      throw new TypeError(
        'TopicReference must be a non-empty string without leading or trailing whitespace.',
      );
    }

    return new TopicReference(value);
  }

  /**
   * Determines whether a primitive value can represent a valid
   * TopicReference.
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
   * Compares TopicReference instances by their primitive value.
   */
  equals(other: TopicReference): boolean {
    return other instanceof TopicReference && this.value === other.value;
  }
}
