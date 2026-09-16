export type ContentMetadataValue = string | number | boolean | null;

export type ContentMetadataValues = Readonly<
  Record<string, ContentMetadataValue>
>;

export interface ContentMetadataProps {
  readonly values: ContentMetadataValues;
}

/**
 * Immutable, vendor-neutral content metadata.
 *
 * Metadata intentionally supports only deterministic primitive JSON values at
 * this stage. Rich/nested indexing data belongs in later query/read-model
 * contracts rather than the transactional content entity.
 */
export class ContentMetadata {
  readonly values: ContentMetadataValues;

  private constructor(values: ContentMetadataValues) {
    this.values = Object.freeze({ ...values });
    Object.freeze(this);
  }

  static empty(): ContentMetadata {
    return new ContentMetadata({});
  }

  static from(props: ContentMetadataProps): ContentMetadata {
    if (props === null || typeof props !== 'object') {
      throw new TypeError('ContentMetadata must be created from an object.');
    }

    if (
      props.values === null ||
      typeof props.values !== 'object' ||
      Array.isArray(props.values)
    ) {
      throw new TypeError('ContentMetadata.values must be an object.');
    }

    const values: Record<string, ContentMetadataValue> = {};

    for (const [key, value] of Object.entries(props.values)) {
      if (!ContentMetadata.isCanonicalKey(key)) {
        throw new TypeError(
          'ContentMetadata keys must be non-empty strings without leading or trailing whitespace.',
        );
      }

      if (!ContentMetadata.isSupportedValue(value)) {
        throw new TypeError(
          `Unsupported content metadata value for key: ${key}.`,
        );
      }

      values[key] = value;
    }

    return new ContentMetadata(values);
  }

  static isValid(value: unknown): value is ContentMetadataProps {
    if (value === null || typeof value !== 'object') {
      return false;
    }

    const candidate = value as ContentMetadataProps;

    if (
      candidate.values === null ||
      typeof candidate.values !== 'object' ||
      Array.isArray(candidate.values)
    ) {
      return false;
    }

    return Object.entries(candidate.values).every(
      ([key, metadataValue]) =>
        ContentMetadata.isCanonicalKey(key) &&
        ContentMetadata.isSupportedValue(metadataValue),
    );
  }

  get(key: string): ContentMetadataValue | undefined {
    return this.values[key];
  }

  has(key: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.values, key);
  }

  equals(other: ContentMetadata): boolean {
    if (!(other instanceof ContentMetadata)) {
      return false;
    }

    const keys = Object.keys(this.values);
    const otherKeys = Object.keys(other.values);

    if (keys.length !== otherKeys.length) {
      return false;
    }

    for (const key of keys) {
      if (this.values[key] !== other.values[key]) {
        return false;
      }
    }

    return true;
  }

  toPrimitives(): ContentMetadataProps {
    return Object.freeze({
      values: Object.freeze({ ...this.values }),
    });
  }

  private static isCanonicalKey(value: unknown): value is string {
    return (
      typeof value === 'string' &&
      value.length > 0 &&
      value.trim().length > 0 &&
      value.trim() === value
    );
  }

  private static isSupportedValue(
    value: unknown,
  ): value is ContentMetadataValue {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'boolean'
    ) {
      return true;
    }

    return typeof value === 'number' && Number.isFinite(value);
  }
}
