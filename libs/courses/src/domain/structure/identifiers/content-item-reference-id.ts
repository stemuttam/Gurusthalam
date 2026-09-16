/**
 * Opaque identifier for a structural Content Item reference.
 *
 * This identity belongs to the Course Structure layer.
 *
 * It intentionally does NOT represent the eventual ContentItem aggregate
 * introduced by the later Content Abstraction phase.
 *
 * That separation allows the structure model to reference learning content
 * without coupling itself to content implementations such as:
 * - Video
 * - Audio
 * - PDF
 * - Document
 * - Interactive
 * - Code Exercise
 * - Simulation
 * - External Resource
 * - AI Generated Content
 */
export class ContentItemReferenceId {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;

    Object.freeze(this);
  }

  /**
   * Creates a new ContentItemReferenceId.
   */
  static generate(): ContentItemReferenceId {
    return new ContentItemReferenceId(crypto.randomUUID());
  }

  /**
   * Rehydrates an existing ContentItemReferenceId.
   */
  static from(value: string): ContentItemReferenceId {
    if (typeof value !== 'string' || value.length === 0) {
      throw new TypeError('ContentItemReferenceId must be a non-empty string.');
    }

    if (value.trim().length === 0) {
      throw new TypeError('ContentItemReferenceId must be a non-empty string.');
    }

    if (value.trim() !== value) {
      throw new TypeError(
        'ContentItemReferenceId must not contain leading or trailing whitespace.',
      );
    }

    return new ContentItemReferenceId(value);
  }

  /**
   * Determines whether a primitive value can represent a valid
   * ContentItemReferenceId.
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
  equals(other: ContentItemReferenceId): boolean {
    return (
      other instanceof ContentItemReferenceId && this.value === other.value
    );
  }
}
