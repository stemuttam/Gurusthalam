/**
 * Canonical language identifier used by Course Discovery Metadata.
 *
 * The primary language subtag is restricted to 2–3 alphabetic characters.
 * Additional subtags are supported for regional and script variants such as
 * `en-US`, `hi-IN`, `sr-Latn`, and `zh-Hant-TW`.
 *
 * This value object intentionally implements a conservative language-tag
 * boundary rather than claiming to be a complete BCP 47 parser. A dedicated
 * internationalization boundary can evolve independently if complete locale
 * negotiation becomes a platform requirement.
 */
export class LanguageCode {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;

    Object.freeze(this);
  }

  static from(value: string): LanguageCode {
    if (!LanguageCode.isValid(value)) {
      throw new TypeError(
        'LanguageCode must be a valid 2–3 character language tag without leading or trailing whitespace.',
      );
    }

    return new LanguageCode(value);
  }

  static isValid(value: unknown): value is string {
    if (typeof value !== 'string') {
      return false;
    }

    if (value.length === 0 || value.trim() !== value) {
      return false;
    }

    return /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{1,8})*$/.test(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: LanguageCode): boolean {
    return other instanceof LanguageCode && this.value === other.value;
  }
}
