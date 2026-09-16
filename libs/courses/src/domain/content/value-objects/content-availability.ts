export interface ContentAvailabilityProps {
  readonly enabled: boolean;
  readonly availableFrom: Date | null;
  readonly availableUntil: Date | null;
}

/**
 * Time-aware availability window for content.
 *
 * Availability is a domain capability, not a delivery or authorization
 * decision. Access-control policy remains outside this value object.
 */
export class ContentAvailability {
  readonly enabled: boolean;
  readonly availableFrom: Date | null;
  readonly availableUntil: Date | null;

  private constructor(props: ContentAvailabilityProps) {
    this.enabled = props.enabled;
    this.availableFrom = ContentAvailability.cloneDate(props.availableFrom);
    this.availableUntil = ContentAvailability.cloneDate(props.availableUntil);

    Object.freeze(this);
  }

  static alwaysAvailable(): ContentAvailability {
    return new ContentAvailability({
      enabled: true,
      availableFrom: null,
      availableUntil: null,
    });
  }

  static from(props: ContentAvailabilityProps): ContentAvailability {
    if (props === null || typeof props !== 'object') {
      throw new TypeError(
        'ContentAvailability must be created from an object.',
      );
    }

    if (typeof props.enabled !== 'boolean') {
      throw new TypeError('ContentAvailability.enabled must be a boolean.');
    }

    const availableFrom = ContentAvailability.validateDate(
      props.availableFrom,
      'availableFrom',
    );

    const availableUntil = ContentAvailability.validateDate(
      props.availableUntil,
      'availableUntil',
    );

    if (
      availableFrom !== null &&
      availableUntil !== null &&
      availableFrom > availableUntil
    ) {
      throw new TypeError(
        'ContentAvailability.availableFrom must not be later than availableUntil.',
      );
    }

    return new ContentAvailability({
      enabled: props.enabled,
      availableFrom,
      availableUntil,
    });
  }

  static isValid(value: unknown): value is ContentAvailabilityProps {
    if (value === null || typeof value !== 'object') {
      return false;
    }

    const candidate = value as ContentAvailabilityProps;

    if (typeof candidate.enabled !== 'boolean') {
      return false;
    }

    const from = ContentAvailability.tryGetTime(candidate.availableFrom);

    const until = ContentAvailability.tryGetTime(candidate.availableUntil);

    return (
      from !== 'invalid' &&
      until !== 'invalid' &&
      (from === null || until === null || from <= until)
    );
  }

  isAvailableAt(at: Date = new Date()): boolean {
    if (!(at instanceof Date) || Number.isNaN(at.getTime())) {
      throw new TypeError(
        'ContentAvailability.isAvailableAt requires a valid Date.',
      );
    }

    if (!this.enabled) {
      return false;
    }

    const time = at.getTime();

    const start = this.availableFrom?.getTime() ?? null;

    const end = this.availableUntil?.getTime() ?? null;

    if (start !== null && time < start) {
      return false;
    }

    if (end !== null && time > end) {
      return false;
    }

    return true;
  }

  equals(other: ContentAvailability): boolean {
    if (!(other instanceof ContentAvailability)) {
      return false;
    }

    return (
      this.enabled === other.enabled &&
      ContentAvailability.sameDate(this.availableFrom, other.availableFrom) &&
      ContentAvailability.sameDate(this.availableUntil, other.availableUntil)
    );
  }

  toPrimitives(): ContentAvailabilityProps {
    return Object.freeze({
      enabled: this.enabled,
      availableFrom: ContentAvailability.cloneDate(this.availableFrom),
      availableUntil: ContentAvailability.cloneDate(this.availableUntil),
    });
  }

  private static validateDate(value: unknown, field: string): Date | null {
    if (value === null) {
      return null;
    }

    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      throw new TypeError(
        `ContentAvailability.${field} must be a valid Date or null.`,
      );
    }

    return new Date(value.getTime());
  }

  private static tryGetTime(value: unknown): number | null | 'invalid' {
    if (value === null) {
      return null;
    }

    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      return 'invalid';
    }

    return value.getTime();
  }

  private static cloneDate(value: Date | null): Date | null {
    return value === null ? null : new Date(value.getTime());
  }

  private static sameDate(first: Date | null, second: Date | null): boolean {
    return (
      (first === null && second === null) ||
      (first !== null &&
        second !== null &&
        first.getTime() === second.getTime())
    );
  }
}
