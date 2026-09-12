import {
  CourseVersion,
  type CourseVersionProps,
} from '../entities/course-version.js';

/**
 * Stable schema identifier for the domain-level CourseVersion snapshot.
 *
 * This is deliberately separate from the CourseVersion number itself.
 * The CourseVersion number identifies a business/content revision,
 * whereas snapshotSchemaVersion identifies the shape of this snapshot
 * contract.
 */
export const COURSE_VERSION_SNAPSHOT_SCHEMA_VERSION = 1 as const;

export interface CourseVersionSnapshot {
  readonly snapshotSchemaVersion: typeof COURSE_VERSION_SNAPSHOT_SCHEMA_VERSION;
  readonly id: string;
  readonly courseId: string;
  readonly version: number;
  readonly status: CourseVersionProps['status'];
  readonly title: string;
  readonly description: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly publishedAt: string | null;
}

/**
 * Creates a detached, immutable representation of a CourseVersion.
 *
 * Design goals:
 * - no persistence coupling
 * - deterministic field set
 * - serializable representation
 * - detached from mutable Date instances
 * - safe for comparison and future persistence
 *
 * Content/section/lesson snapshots intentionally do not belong here yet.
 * They will be introduced by the later Structure and Content roadmap
 * layers without changing this snapshot contract.
 */
export function createCourseVersionSnapshot(
  courseVersion: CourseVersion,
): CourseVersionSnapshot {
  const primitives = courseVersion.toPrimitives();

  const snapshot: CourseVersionSnapshot = {
    snapshotSchemaVersion: COURSE_VERSION_SNAPSHOT_SCHEMA_VERSION,
    id: primitives.id.value,
    courseId: primitives.courseId,
    version: primitives.version,
    status: primitives.status,
    title: primitives.title,
    description: primitives.description,
    createdAt: primitives.createdAt.toISOString(),
    updatedAt: primitives.updatedAt.toISOString(),
    publishedAt:
      primitives.publishedAt === null
        ? null
        : primitives.publishedAt.toISOString(),
  };

  return Object.freeze(snapshot);
}
