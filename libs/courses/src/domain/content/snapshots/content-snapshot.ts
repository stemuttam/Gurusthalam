import type { Content } from '../entities/content.js';
import type { ContentPrimitives } from '../entities/content.js';

export const CONTENT_SNAPSHOT_SCHEMA_VERSION = 1 as const;

export interface ContentSnapshot {
  readonly snapshotSchemaVersion: typeof CONTENT_SNAPSHOT_SCHEMA_VERSION;
  readonly id: string;
  readonly type: ContentPrimitives['type'];
  readonly version: number;
  readonly source: ContentPrimitives['source'];
  readonly metadata: ContentPrimitives['metadata'];
  readonly accessibility: ContentPrimitives['accessibility'];
  readonly availability: {
    readonly enabled: boolean;
    readonly availableFrom: string | null;
    readonly availableUntil: string | null;
  };
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Creates a detached, immutable snapshot of a Content entity.
 *
 * Snapshot responsibilities:
 * - preserve the complete generic Content abstraction
 * - provide a deterministic, serializable representation
 * - preserve Content identity and version
 * - detach nested mutable collections
 * - normalize Date values to ISO strings
 * - remain independent from persistence and infrastructure
 *
 * Deliberately excluded:
 * - Prisma/database types
 * - storage-provider implementations
 * - media processing state
 * - delivery state
 * - authorization state
 * - embeddings/vector identifiers
 * - ranking/recommendation scores
 * - model/provider metadata
 * - other AI/ML operational artifacts
 */
export function createContentSnapshot(content: Content): ContentSnapshot {
  return createContentSnapshotFromPrimitives(content.toPrimitives());
}

/**
 * Creates a Content snapshot from an already detached primitive
 * representation.
 *
 * This helper is intentionally kept internal to the snapshot module so the
 * public API remains focused on the Content entity -> snapshot boundary.
 */
function createContentSnapshotFromPrimitives(
  primitives: ContentPrimitives,
): ContentSnapshot {
  const snapshot: ContentSnapshot = {
    snapshotSchemaVersion: CONTENT_SNAPSHOT_SCHEMA_VERSION,

    id: primitives.id,

    type: primitives.type,

    version: primitives.version,

    source: {
      kind: primitives.source.kind,
      locator: primitives.source.locator,
    },

    metadata: {
      values: {
        ...primitives.metadata.values,
      },
    },

    accessibility: {
      features: [...primitives.accessibility.features],
    },

    availability: {
      enabled: primitives.availability.enabled,

      availableFrom:
        primitives.availability.availableFrom === null
          ? null
          : primitives.availability.availableFrom.toISOString(),

      availableUntil:
        primitives.availability.availableUntil === null
          ? null
          : primitives.availability.availableUntil.toISOString(),
    },

    createdAt: primitives.createdAt.toISOString(),

    updatedAt: primitives.updatedAt.toISOString(),
  };

  return Object.freeze(snapshot);
}
