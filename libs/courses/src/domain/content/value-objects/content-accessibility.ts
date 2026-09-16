export interface ContentAccessibilityProps {
  readonly features: readonly string[];
}

/**
 * Extensible list of accessibility capabilities associated with content.
 *
 * The domain keeps these feature names vendor- and standard-neutral; a later
 * accessibility policy can provide a controlled vocabulary without changing
 * Content identity.
 */
export class ContentAccessibility {
  readonly features: readonly string[];

  private constructor(features: readonly string[]) {
    this.features = Object.freeze([...features]);
    Object.freeze(this);
  }

  static empty(): ContentAccessibility {
    return new ContentAccessibility([]);
  }

  static from(props: ContentAccessibilityProps): ContentAccessibility {
    if (props === null || typeof props !== 'object') {
      throw new TypeError(
        'ContentAccessibility must be created from an object.',
      );
    }

    if (!Array.isArray(props.features)) {
      throw new TypeError('ContentAccessibility.features must be an array.');
    }

    const seen = new Set<string>();
    const features: string[] = [];

    for (const feature of props.features) {
      if (!ContentAccessibility.isCanonicalText(feature)) {
        throw new TypeError(
          'ContentAccessibility features must be non-empty strings without leading or trailing whitespace.',
        );
      }

      if (seen.has(feature)) {
        throw new TypeError(
          `Duplicate content accessibility feature: ${feature}.`,
        );
      }

      seen.add(feature);
      features.push(feature);
    }

    return new ContentAccessibility(features);
  }

  static isValid(value: unknown): value is ContentAccessibilityProps {
    if (value === null || typeof value !== 'object') {
      return false;
    }

    const candidate = value as ContentAccessibilityProps;

    if (!Array.isArray(candidate.features)) {
      return false;
    }

    const seen = new Set<string>();

    for (const feature of candidate.features) {
      if (!ContentAccessibility.isCanonicalText(feature) || seen.has(feature)) {
        return false;
      }

      seen.add(feature);
    }

    return true;
  }

  supports(feature: string): boolean {
    return this.features.includes(feature);
  }

  equals(other: ContentAccessibility): boolean {
    return (
      other instanceof ContentAccessibility &&
      this.features.length === other.features.length &&
      this.features.every((feature, index) => feature === other.features[index])
    );
  }

  toPrimitives(): ContentAccessibilityProps {
    return Object.freeze({
      features: Object.freeze([...this.features]),
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
