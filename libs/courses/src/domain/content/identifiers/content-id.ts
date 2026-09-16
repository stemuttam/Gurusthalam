/**
 * Opaque identifier for a Content entity.
 *
 * The Course domain intentionally treats content identity as an opaque value.
 * Persistence-specific identifier types must not leak into this boundary.
 */
export class ContentId {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;

    Object.freeze(this);
  }

  static generate(): ContentId {
    return new ContentId(crypto.randomUUID());
  }

  static from(value: string): ContentId {
    if (!ContentId.isValid(value)) {
      throw new TypeError(
        'ContentId must be a non-empty string without leading or trailing whitespace.',
      );
    }

    return new ContentId(value);
  }

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

  equals(other: ContentId): boolean {
    return other instanceof ContentId && this.value === other.value;
  }
}
