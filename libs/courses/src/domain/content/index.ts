/**
 * Course Content Abstraction
 *
 * The content domain models generic content identity, modality, version,
 * source, metadata, accessibility and availability. Concrete media processing,
 * delivery infrastructure, AI artifacts and persistence details remain outside
 * this boundary.
 */
export { Content } from './entities/content.js';

export type {
  ContentPrimitives,
  ContentProps,
  CreateContentProps,
  RehydrateContentProps,
} from './entities/content.js';

export {
  CONTENT_TYPES,
  ContentType,
  isContentType,
} from './enums/content-type.js';

export { ContentId } from './identifiers/content-id.js';

export {
  ContentAccessibility,
  ContentAvailability,
  ContentMetadata,
  ContentSource,
  ContentVersion,
} from './value-objects/index.js';

export type {
  ContentAccessibilityProps,
  ContentAvailabilityProps,
  ContentMetadataProps,
  ContentMetadataValue,
  ContentMetadataValues,
  ContentSourceProps,
} from './value-objects/index.js';
