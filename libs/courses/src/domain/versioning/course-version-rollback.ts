import { CourseValidationError } from '../errors/index.js';
import { CourseVersion } from '../entities/course-version.js';
import { CourseVersionLineage } from './course-version-lineage.js';

export interface CreateCourseVersionRollbackProps {
  /**
   * Historical CourseVersion whose business content is being restored.
   *
   * The source version itself is never modified.
   */
  readonly source: CourseVersion;

  /**
   * New forward version number that will be assigned to the rollback
   * result.
   *
   * The caller is responsible for obtaining the next available version
   * number from the persistence/application layer.
   */
  readonly targetVersion: number;

  /**
   * Human-readable reason for creating the rollback-derived version.
   */
  readonly reason: string;
}

export interface CourseVersionRollbackResult {
  /**
   * Newly created forward CourseVersion.
   *
   * This is always a fresh identity and always starts in DRAFT.
   */
  readonly version: CourseVersion;

  /**
   * Immutable source → target lineage relationship.
   */
  readonly lineage: CourseVersionLineage;
}

/**
 * Creates a new forward CourseVersion derived from a historical version.
 *
 * Rollback is intentionally modeled as version creation, not mutation.
 *
 * Example:
 *
 *   V1 PUBLISHED
 *   V2 PUBLISHED
 *   V3 PUBLISHED
 *
 *   rollback V3 → V1
 *
 *   produces:
 *
 *   V4 DRAFT
 *      └── DERIVED_FROM → V1
 *
 * Existing versions remain untouched.
 *
 * This service is intentionally persistence-independent and contains no:
 * - Prisma
 * - HTTP
 * - NestJS
 * - queues
 * - notifications
 * - AI/ML infrastructure
 */
export function createCourseVersionRollback(
  input: CreateCourseVersionRollbackProps,
): CourseVersionRollbackResult {
  validateRollbackInput(input);

  const source = input.source;

  const restoredVersion = CourseVersion.create({
    courseId: source.courseId,
    version: input.targetVersion,
    title: source.title,
    description: source.description,
  });

  const lineage = CourseVersionLineage.create({
    source,
    target: restoredVersion,
    reason: input.reason,
  });

  return Object.freeze({
    version: restoredVersion,
    lineage,
  });
}

function validateRollbackInput(input: CreateCourseVersionRollbackProps): void {
  const issues: Array<{
    field: string;
    message: string;
  }> = [];

  if (!(input.source instanceof CourseVersion)) {
    issues.push({
      field: 'source',
      message: 'Rollback source must be a valid CourseVersion.',
    });
  } else if (
    input.source.status !== 'PUBLISHED' &&
    input.source.status !== 'ARCHIVED'
  ) {
    issues.push({
      field: 'source',
      message:
        'Rollback source must be an immutable PUBLISHED or ARCHIVED CourseVersion.',
    });
  }

  if (!Number.isInteger(input.targetVersion) || input.targetVersion < 1) {
    issues.push({
      field: 'targetVersion',
      message: 'Rollback target version must be a positive integer.',
    });
  } else if (
    input.source instanceof CourseVersion &&
    input.targetVersion <= input.source.version
  ) {
    issues.push({
      field: 'targetVersion',
      message:
        'Rollback target version must be greater than the source version.',
    });
  }

  if (typeof input.reason !== 'string' || input.reason.trim().length === 0) {
    issues.push({
      field: 'reason',
      message: 'Rollback reason must be a non-empty string.',
    });
  } else if (input.reason.trim().length > 500) {
    issues.push({
      field: 'reason',
      message: 'Rollback reason must not exceed 500 characters.',
    });
  }

  if (issues.length > 0) {
    throw new CourseValidationError(
      'CourseVersion rollback validation failed.',
      issues,
    );
  }
}
