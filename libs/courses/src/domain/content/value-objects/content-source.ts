export interface ContentSourceProps {
  readonly kind: string;
  readonly locator: string;
}

/**
 * Generic source descriptor for content.
 *
 * `kind` is intentionally open-ended so the domain does not hard-code a
 * storage, media or vendor taxonomy. `locator` is an opaque address supplied
 * by the owning application/infrastructure boundary.
 */
export class ContentSource {
  readonly kind: string;
  readonly locator: string;

  private constructor(props: ContentSourceProps) {
    this.kind = props.kind;
    this.locator = props.locator;

    Object.freeze(this);
  }

  static from(props: ContentSourceProps): ContentSource {
    if (props === null || typeof props !== 'object') {
      throw new TypeError('ContentSource must be created from an object.');
    }

    if (!ContentSource.isCanonicalText(props.kind)) {
      throw new TypeError(
        'ContentSource.kind must be a non-empty string without leading or trailing whitespace.',
      );
    }

    if (!ContentSource.isCanonicalText(props.locator)) {
      throw new TypeError(
        'ContentSource.locator must be a non-empty string without leading or trailing whitespace.',
      );
    }

    return new ContentSource({
      kind: props.kind,
      locator: props.locator,
    });
  }

  static isValid(value: unknown): value is ContentSourceProps {
    if (value === null || typeof value !== 'object') {
      return false;
    }

    const candidate = value as ContentSourceProps;

    return (
      ContentSource.isCanonicalText(candidate.kind) &&
      ContentSource.isCanonicalText(candidate.locator)
    );
  }

  equals(other: ContentSource): boolean {
    return (
      other instanceof ContentSource &&
      this.kind === other.kind &&
      this.locator === other.locator
    );
  }

  toPrimitives(): ContentSourceProps {
    return Object.freeze({
      kind: this.kind,
      locator: this.locator,
    });
  }

  private static isCanonicalText(value: unknown): value is string {
    return (
      typeof value === 'string' &&
      value.length > 0 &&
      value.trim().length > 0 &&
      value.trim() === value
    );
  }
}
