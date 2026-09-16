/**
 * Immutable positive integer content version.
 *
 * Versioning is deliberately represented separately from Content identity so
 * later persistence/application layers can evolve content without changing
 * the identity contract.
 */
export class ContentVersion {
  readonly value: number;

  private constructor(value: number) {
    this.value = value;
    Object.freeze(this);
  }

  static initial(): ContentVersion {
    return new ContentVersion(1);
  }

  static from(value: number): ContentVersion {
    if (!ContentVersion.isValid(value)) {
      throw new TypeError('ContentVersion must be a positive integer.');
    }

    return new ContentVersion(value);
  }

  static isValid(value: unknown): value is number {
    return (
      typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    );
  }

  next(): ContentVersion {
    if (this.value === Number.MAX_SAFE_INTEGER) {
      throw new RangeError(
        'ContentVersion cannot be incremented beyond Number.MAX_SAFE_INTEGER.',
      );
    }

    return new ContentVersion(this.value + 1);
  }

  toNumber(): number {
    return this.value;
  }

  toString(): string {
    return String(this.value);
  }

  equals(other: ContentVersion): boolean {
    return other instanceof ContentVersion && this.value === other.value;
  }
}
