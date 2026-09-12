import type { CourseVersionSnapshot } from './course-version-snapshot.js';
import { COURSE_VERSION_SNAPSHOT_SCHEMA_VERSION } from './course-version-snapshot.js';

export type SupportedCourseVersionSnapshotSchemaVersion =
  typeof COURSE_VERSION_SNAPSHOT_SCHEMA_VERSION;

export interface CourseVersionSnapshotMigrationResult {
  readonly sourceSchemaVersion: number;
  readonly targetSchemaVersion: SupportedCourseVersionSnapshotSchemaVersion;
  readonly migrated: boolean;
  readonly snapshot: CourseVersionSnapshot;
}

export class CourseVersionSnapshotMigrationError extends TypeError {
  readonly sourceSchemaVersion: number | null;
  readonly targetSchemaVersion: number;

  constructor(
    message: string,
    options: {
      readonly sourceSchemaVersion?: number | null;
      readonly targetSchemaVersion?: number;
    } = {},
  ) {
    super(message);

    this.name = 'CourseVersionSnapshotMigrationError';

    this.sourceSchemaVersion = options.sourceSchemaVersion ?? null;

    this.targetSchemaVersion =
      options.targetSchemaVersion ?? COURSE_VERSION_SNAPSHOT_SCHEMA_VERSION;

    Object.setPrototypeOf(this, CourseVersionSnapshotMigrationError.prototype);
  }
}

/**
 * Determines whether a value is a currently supported
 * CourseVersionSnapshot schema version.
 */
export function isSupportedCourseVersionSnapshotSchemaVersion(
  value: unknown,
): value is SupportedCourseVersionSnapshotSchemaVersion {
  return value === COURSE_VERSION_SNAPSHOT_SCHEMA_VERSION;
}

/**
 * Migrates a persisted CourseVersion snapshot to the current canonical
 * snapshot contract.
 *
 * Current state:
 * - schema version 1 is the canonical schema
 * - schema version 1 therefore requires no field migration
 * - a fresh detached object is still produced
 *
 * Future state:
 * - when schema version 2 is introduced, this boundary becomes the single
 *   migration entry point for V1 → V2
 * - callers will not need to know historical snapshot representations
 *
 * Unknown/future schema versions are rejected deliberately rather than
 * silently truncated or interpreted as the current schema.
 */
export function migrateCourseVersionSnapshot(
  input: unknown,
): CourseVersionSnapshotMigrationResult {
  const sourceSchemaVersion = getSnapshotSchemaVersion(input);

  if (!isSupportedCourseVersionSnapshotSchemaVersion(sourceSchemaVersion)) {
    throw new CourseVersionSnapshotMigrationError(
      `Unsupported CourseVersion snapshot schema version: ${String(
        sourceSchemaVersion,
      )}.`,
      {
        sourceSchemaVersion:
          typeof sourceSchemaVersion === 'number' ? sourceSchemaVersion : null,
      },
    );
  }

  const snapshot = validateAndCloneCurrentSnapshot(input);

  return Object.freeze({
    sourceSchemaVersion,
    targetSchemaVersion: COURSE_VERSION_SNAPSHOT_SCHEMA_VERSION,
    migrated: false,
    snapshot,
  });
}

/**
 * Validates a persisted value as a supported canonical
 * CourseVersionSnapshot without mutating it.
 */
export function isCompatibleCourseVersionSnapshot(
  value: unknown,
): value is CourseVersionSnapshot {
  try {
    migrateCourseVersionSnapshot(value);

    return true;
  } catch {
    return false;
  }
}

function getSnapshotSchemaVersion(input: unknown): unknown {
  if (input === null || typeof input !== 'object') {
    return null;
  }

  return (
    (
      input as {
        readonly snapshotSchemaVersion?: unknown;
      }
    ).snapshotSchemaVersion ?? null
  );
}

function validateAndCloneCurrentSnapshot(
  input: unknown,
): CourseVersionSnapshot {
  if (input === null || typeof input !== 'object') {
    throw new CourseVersionSnapshotMigrationError(
      'CourseVersion snapshot must be an object.',
      {
        sourceSchemaVersion: null,
      },
    );
  }

  const candidate = input as Record<string, unknown>;

  const issues: string[] = [];

  if (typeof candidate.id !== 'string' || candidate.id.trim().length === 0) {
    issues.push('id must be a non-empty string');
  }

  if (
    typeof candidate.courseId !== 'string' ||
    candidate.courseId.trim().length === 0
  ) {
    issues.push('courseId must be a non-empty string');
  }

  if (
    !Number.isInteger(candidate.version) ||
    (candidate.version as number) < 1
  ) {
    issues.push('version must be a positive integer');
  }

  if (
    candidate.status !== 'DRAFT' &&
    candidate.status !== 'IN_REVIEW' &&
    candidate.status !== 'PUBLISHED' &&
    candidate.status !== 'ARCHIVED'
  ) {
    issues.push('status must be a supported CourseVersion status');
  }

  if (
    typeof candidate.title !== 'string' ||
    candidate.title.trim().length === 0
  ) {
    issues.push('title must be a non-empty string');
  }

  if (
    candidate.description !== null &&
    typeof candidate.description !== 'string'
  ) {
    issues.push('description must be a string or null');
  }

  if (
    typeof candidate.createdAt !== 'string' ||
    Number.isNaN(Date.parse(candidate.createdAt))
  ) {
    issues.push('createdAt must be a valid ISO timestamp string');
  }

  if (
    typeof candidate.updatedAt !== 'string' ||
    Number.isNaN(Date.parse(candidate.updatedAt))
  ) {
    issues.push('updatedAt must be a valid ISO timestamp string');
  }

  if (
    candidate.publishedAt !== null &&
    (typeof candidate.publishedAt !== 'string' ||
      Number.isNaN(Date.parse(candidate.publishedAt)))
  ) {
    issues.push('publishedAt must be null or a valid ISO timestamp string');
  }

  if (issues.length > 0) {
    throw new CourseVersionSnapshotMigrationError(
      `Invalid CourseVersion snapshot: ${issues.join('; ')}.`,
      {
        sourceSchemaVersion:
          typeof candidate.snapshotSchemaVersion === 'number'
            ? candidate.snapshotSchemaVersion
            : null,
      },
    );
  }

  const snapshot: CourseVersionSnapshot = {
    snapshotSchemaVersion: COURSE_VERSION_SNAPSHOT_SCHEMA_VERSION,
    id: candidate.id as string,
    courseId: candidate.courseId as string,
    version: candidate.version as number,
    status: candidate.status as CourseVersionSnapshot['status'],
    title: candidate.title as string,
    description: candidate.description as string | null,
    createdAt: new Date(candidate.createdAt as string).toISOString(),
    updatedAt: new Date(candidate.updatedAt as string).toISOString(),
    publishedAt:
      candidate.publishedAt === null
        ? null
        : new Date(candidate.publishedAt as string).toISOString(),
  };

  return Object.freeze(snapshot);
}
