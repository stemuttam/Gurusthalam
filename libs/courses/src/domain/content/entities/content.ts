import { CourseValidationError } from '../../errors/course-validation.error.js';
import { ContentType, isContentType } from '../enums/content-type.js';
import { ContentId } from '../identifiers/content-id.js';
import {
  ContentAccessibility,
  ContentAccessibilityProps,
} from '../value-objects/content-accessibility.js';
import {
  ContentAvailability,
  ContentAvailabilityProps,
} from '../value-objects/content-availability.js';
import {
  ContentMetadata,
  ContentMetadataProps,
} from '../value-objects/content-metadata.js';
import {
  ContentSource,
  ContentSourceProps,
} from '../value-objects/content-source.js';
import { ContentVersion } from '../value-objects/content-version.js';

export interface ContentProps {
  readonly id: ContentId;
  readonly type: ContentType;
  readonly version: ContentVersion;
  readonly source: ContentSource;
  readonly metadata: ContentMetadata;
  readonly accessibility: ContentAccessibility;
  readonly availability: ContentAvailability;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateContentProps {
  readonly id?: ContentId;
  readonly type: ContentType;
  readonly source: ContentSource | ContentSourceProps;
  readonly metadata?: ContentMetadata | ContentMetadataProps;
  readonly accessibility?: ContentAccessibility | ContentAccessibilityProps;
  readonly availability?: ContentAvailability | ContentAvailabilityProps;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}

export interface RehydrateContentProps {
  readonly id: ContentId;
  readonly type: ContentType;
  readonly version: ContentVersion | number;
  readonly source: ContentSource | ContentSourceProps;
  readonly metadata: ContentMetadata | ContentMetadataProps;
  readonly accessibility: ContentAccessibility | ContentAccessibilityProps;
  readonly availability: ContentAvailability | ContentAvailabilityProps;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ContentPrimitives {
  readonly id: string;
  readonly type: ContentType;
  readonly version: number;
  readonly source: ContentSourceProps;
  readonly metadata: ContentMetadataProps;
  readonly accessibility: ContentAccessibilityProps;
  readonly availability: ContentAvailabilityProps;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Generic transactional Content entity.
 *
 * It owns only content identity and the generic abstraction dimensions. It does
 * not own media processing, storage, delivery, assessment behavior, AI
 * artifacts or authorization policy.
 */
export class Content {
  private readonly props: ContentProps;

  private constructor(props: ContentProps) {
    this.props = {
      ...props,
      createdAt: new Date(props.createdAt.getTime()),
      updatedAt: new Date(props.updatedAt.getTime()),
    };

    Object.freeze(this.props);
    Object.freeze(this);
  }

  static create(props: CreateContentProps): Content {
    const createdAt = props.createdAt
      ? new Date(props.createdAt.getTime())
      : new Date();

    const updatedAt = props.updatedAt
      ? new Date(props.updatedAt.getTime())
      : new Date(createdAt.getTime());

    return Content.rehydrate({
      id: props.id ?? ContentId.generate(),
      type: props.type,
      version: ContentVersion.initial(),
      source: props.source,
      metadata: props.metadata ?? ContentMetadata.empty(),
      accessibility: props.accessibility ?? ContentAccessibility.empty(),
      availability: props.availability ?? ContentAvailability.alwaysAvailable(),
      createdAt,
      updatedAt,
    });
  }

  static rehydrate(props: RehydrateContentProps): Content {
    const createdAt = Content.validateTimestamp(props.createdAt, 'createdAt');

    const updatedAt = Content.validateTimestamp(props.updatedAt, 'updatedAt');

    if (updatedAt < createdAt) {
      throw new CourseValidationError('Content timestamps are invalid.', [
        {
          field: 'updatedAt',
          message: 'updatedAt must not be earlier than createdAt.',
        },
      ]);
    }

    if (!isContentType(props.type)) {
      throw new TypeError(`Unsupported content type: ${String(props.type)}.`);
    }

    const source = Content.toSource(props.source);

    const metadata = Content.toMetadata(props.metadata);

    const accessibility = Content.toAccessibility(props.accessibility);

    const availability = Content.toAvailability(props.availability);

    const version = Content.toVersion(props.version);

    return new Content({
      id: props.id,
      type: props.type,
      version,
      source,
      metadata,
      accessibility,
      availability,
      createdAt,
      updatedAt,
    });
  }

  get id(): ContentId {
    return this.props.id;
  }

  get type(): ContentType {
    return this.props.type;
  }

  get version(): ContentVersion {
    return this.props.version;
  }

  get source(): ContentSource {
    return this.props.source;
  }

  get metadata(): ContentMetadata {
    return this.props.metadata;
  }

  get accessibility(): ContentAccessibility {
    return this.props.accessibility;
  }

  get availability(): ContentAvailability {
    return this.props.availability;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt.getTime());
  }

  get updatedAt(): Date {
    return new Date(this.props.updatedAt.getTime());
  }

  toPrimitives(): ContentPrimitives {
    return {
      id: this.props.id.toString(),
      type: this.props.type,
      version: this.props.version.toNumber(),
      source: this.props.source.toPrimitives(),
      metadata: this.props.metadata.toPrimitives(),
      accessibility: this.props.accessibility.toPrimitives(),
      availability: this.props.availability.toPrimitives(),
      createdAt: new Date(this.props.createdAt.getTime()),
      updatedAt: new Date(this.props.updatedAt.getTime()),
    };
  }

  private static validateTimestamp(value: Date, field: string): Date {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      throw new CourseValidationError('Content timestamps are invalid.', [
        {
          field,
          message: `${field} must be a valid Date.`,
        },
      ]);
    }

    return new Date(value.getTime());
  }

  private static toVersion(value: ContentVersion | number): ContentVersion {
    return value instanceof ContentVersion ? value : ContentVersion.from(value);
  }

  private static toSource(
    value: ContentSource | ContentSourceProps,
  ): ContentSource {
    return value instanceof ContentSource ? value : ContentSource.from(value);
  }

  private static toMetadata(
    value: ContentMetadata | ContentMetadataProps,
  ): ContentMetadata {
    return value instanceof ContentMetadata
      ? value
      : ContentMetadata.from(value);
  }

  private static toAccessibility(
    value: ContentAccessibility | ContentAccessibilityProps,
  ): ContentAccessibility {
    return value instanceof ContentAccessibility
      ? value
      : ContentAccessibility.from(value);
  }

  private static toAvailability(
    value: ContentAvailability | ContentAvailabilityProps,
  ): ContentAvailability {
    return value instanceof ContentAvailability
      ? value
      : ContentAvailability.from(value);
  }
}
