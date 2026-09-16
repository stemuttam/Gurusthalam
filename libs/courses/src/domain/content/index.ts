/**
 * Course Content Abstraction
 *
 * The content domain models generic content identity, modality, version,
 * source, metadata, accessibility, availability, and immutable snapshots.
 *
 * Concrete media processing, delivery infrastructure, AI artifacts,
 * persistence details, and provider-specific behavior remain outside
 * this domain boundary.
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

/**
 * Immutable Content snapshot boundary.
 *
 * Snapshot schema versioning is independent from the business Content
 * version so representation evolution can occur without changing
 * Content identity/version semantics.
 */
export {
  CONTENT_SNAPSHOT_SCHEMA_VERSION,
  createContentSnapshot,
} from './snapshots/content-snapshot.js';

export type { ContentSnapshot } from './snapshots/content-snapshot.js';

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
