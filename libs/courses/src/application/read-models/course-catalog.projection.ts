import type { CourseLevel as CourseLevelValue } from '../../domain/enums/course-level.js';
import type { CourseStatus as CourseStatusValue } from '../../domain/enums/course-status.js';
import type { CourseType as CourseTypeValue } from '../../domain/enums/course-type.js';
import type { CourseVisibility as CourseVisibilityValue } from '../../domain/enums/course-visibility.js';

/**
 * Schema version of the CourseCatalog projection contract.
 *
 * This is deliberately independent from:
 * - Prisma schema versions;
 * - database migration versions;
 * - domain-event versions;
 * - search-engine index versions;
 * - AI model versions.
 *
 * Projection evolution must remain independently manageable.
 */
export const COURSE_CATALOG_PROJECTION_SCHEMA_VERSION = 1 as const;

export type CourseCatalogProjectionSchemaVersion =
  typeof COURSE_CATALOG_PROJECTION_SCHEMA_VERSION;

/**
 * Canonical Course read-side representation used by catalog-oriented
 * consumers.
 *
 * This is a derived projection.
 *
 * It is NOT:
 * - the Course aggregate;
 * - a persistence entity;
 * - a Prisma model;
 * - a domain-event payload;
 * - an authorization decision;
 * - an AI representation.
 *
 * The transactional Course remains the source of truth.
 */
export interface CourseCatalogProjection {
  /**
   * Stable Course identity.
   *
   * This must remain identical to the transactional Course identifier.
   */
  readonly courseId: string;

  readonly title: string;

  readonly description: string | null;

  readonly level: CourseLevelValue;

  readonly type: CourseTypeValue;

  readonly visibility: CourseVisibilityValue;

  readonly status: CourseStatusValue;

  /**
   * Identity of the current Course instructor.
   *
   * This deliberately does not model CourseOwnership because ownership
   * is a separate Course-domain concern and authorization remains outside
   * the read-model contract.
   */
  readonly instructorId: string;

  /**
   * Timestamp originating from the authoritative Course model.
   */
  readonly createdAt: Date;

  /**
   * Timestamp originating from the authoritative Course model.
   */
  readonly updatedAt: Date;

  /**
   * Version of this read-model contract.
   *
   * This allows the projection representation to evolve without coupling
   * its version to the transactional Course schema.
   */
  readonly projectionSchemaVersion: CourseCatalogProjectionSchemaVersion;
}

/**
 * Creates an immutable CourseCatalog projection.
 *
 * The function performs structural normalization only. Business rules,
 * lifecycle rules, authorization, persistence and event processing remain
 * outside this model.
 */
export function createCourseCatalogProjection(
  input: Omit<CourseCatalogProjection, 'projectionSchemaVersion'> & {
    readonly projectionSchemaVersion?: CourseCatalogProjectionSchemaVersion;
  },
): CourseCatalogProjection {
  return Object.freeze({
    courseId: input.courseId,
    title: input.title,
    description: input.description,
    level: input.level,
    type: input.type,
    visibility: input.visibility,
    status: input.status,
    instructorId: input.instructorId,
    createdAt: new Date(input.createdAt),
    updatedAt: new Date(input.updatedAt),
    projectionSchemaVersion:
      input.projectionSchemaVersion ?? COURSE_CATALOG_PROJECTION_SCHEMA_VERSION,
  });
}
