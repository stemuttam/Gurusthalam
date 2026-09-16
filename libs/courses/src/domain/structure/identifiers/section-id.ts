/**
 * Opaque identifier for a Course Structure Section.
 *
 * SectionId represents the stable identity of a Section inside the
 * Course Structure domain.
 *
 * The identifier is intentionally independent from:
 * - Prisma
 * - database primary-key implementations
 * - HTTP
 * - NestJS
 * - application services
 * - API DTOs
 *
 * A SectionId must remain stable when a Section is reordered or moved.
 */
export class SectionId {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;

    Object.freeze(this);
  }

  /**
   * Creates a new SectionId.
   *
   * UUID generation is kept inside the domain boundary so callers do not
   * need to know how identifiers are generated.
   */
  static generate(): SectionId {
    return new SectionId(crypto.randomUUID());
  }

  /**
   * Rehydrates an existing SectionId.
   *
   * Values are treated as opaque identifiers. The domain therefore does not
   * require UUID syntax for persisted identifiers.
   *
   * Leading and trailing whitespace is rejected rather than normalized.
   */
  static from(value: string): SectionId {
    if (typeof value !== 'string' || value.length === 0) {
      throw new TypeError('SectionId must be a non-empty string.');
    }

    if (value.trim().length === 0) {
      throw new TypeError('SectionId must be a non-empty string.');
    }

    if (value.trim() !== value) {
      throw new TypeError(
        'SectionId must not contain leading or trailing whitespace.',
      );
    }

    return new SectionId(value);
  }

  /**
   * Determines whether a primitive value can represent a valid SectionId.
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
  equals(other: SectionId): boolean {
    return other instanceof SectionId && this.value === other.value;
  }
}
