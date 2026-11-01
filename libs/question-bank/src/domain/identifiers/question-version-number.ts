/**
 * Positive, safely representable sequential revision number for a Question.
 *
 * A QuestionVersionNumber represents ordering within one owning Question.
 * It is not a globally unique identifier and must always be interpreted
 * together with the owning QuestionId.
 *
 * The first version number is 1.
 *
 * This value object validates an individual number and provides a safe
 * successor operation. Enforcing that a Question's next persisted version
 * is sequential belongs to the Question-level domain operation.
 */
export class QuestionVersionNumber {
  static readonly INITIAL_VALUE = 1;

  static readonly MAX_VALUE = Number.MAX_SAFE_INTEGER;

  readonly value: number;

  private constructor(value: number) {
    this.value = value;

    Object.freeze(this);
  }

  /**
   * Creates the initial version number for a newly created Question.
   */
  static initial(): QuestionVersionNumber {
    return new QuestionVersionNumber(QuestionVersionNumber.INITIAL_VALUE);
  }

  /**
   * Rehydrates an existing positive safe-integer version number.
   *
   * Values are preserved exactly. No rounding, truncation, coercion,
   * or normalization is performed.
   */
  static from(value: number): QuestionVersionNumber {
    if (!QuestionVersionNumber.isValid(value)) {
      throw new TypeError(
        'QuestionVersionNumber must be a positive safe integer.',
      );
    }

    return new QuestionVersionNumber(value);
  }

  /**
   * Determines whether a primitive value is a valid version number.
   */
  static isValid(value: unknown): value is number {
    return (
      typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value >= QuestionVersionNumber.INITIAL_VALUE
    );
  }

  /**
   * Returns the next sequential version number.
   *
   * Throws when the current value has reached Number.MAX_SAFE_INTEGER,
   * because incrementing beyond it would no longer be safely representable.
   */
  next(): QuestionVersionNumber {
    if (this.value === QuestionVersionNumber.MAX_VALUE) {
      throw new RangeError(
        'QuestionVersionNumber cannot exceed Number.MAX_SAFE_INTEGER.',
      );
    }

    return new QuestionVersionNumber(this.value + 1);
  }

  /**
   * Compares version numbers by their numeric values.
   */
  equals(other: QuestionVersionNumber): boolean {
    return other instanceof QuestionVersionNumber && this.value === other.value;
  }

  /**
   * Returns the primitive numeric value.
   */
  toNumber(): number {
    return this.value;
  }

  /**
   * Returns the decimal representation of the version number.
   */
  toString(): string {
    return String(this.value);
  }
}

// Freeze the class constructor to protect static constants and methods at runtime
Object.freeze(QuestionVersionNumber);
