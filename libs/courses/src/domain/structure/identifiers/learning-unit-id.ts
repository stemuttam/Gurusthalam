/**
 * Opaque identifier for a Course Structure Learning Unit.
 *
 * LearningUnitId represents the stable identity of a Learning Unit.
 *
 * The identity must remain stable across structural operations such as:
 * - reordering
 * - moving between sections
 * - changing presentation order
 *
 * The identifier does not represent the content implementation itself.
 */
export class LearningUnitId {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;

    Object.freeze(this);
  }

  /**
   * Creates a new LearningUnitId.
   */
  static generate(): LearningUnitId {
    return new LearningUnitId(crypto.randomUUID());
  }

  /**
   * Rehydrates an existing LearningUnitId.
   *
   * The identifier remains opaque. UUID syntax is therefore not required.
   */
  static from(value: string): LearningUnitId {
    if (typeof value !== 'string' || value.length === 0) {
      throw new TypeError('LearningUnitId must be a non-empty string.');
    }

    if (value.trim().length === 0) {
      throw new TypeError('LearningUnitId must be a non-empty string.');
    }

    if (value.trim() !== value) {
      throw new TypeError(
        'LearningUnitId must not contain leading or trailing whitespace.',
      );
    }

    return new LearningUnitId(value);
  }

  /**
   * Determines whether a primitive value can represent a valid
   * LearningUnitId.
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
  equals(other: LearningUnitId): boolean {
    return other instanceof LearningUnitId && this.value === other.value;
  }
}
