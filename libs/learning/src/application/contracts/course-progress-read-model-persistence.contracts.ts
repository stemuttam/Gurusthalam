import type { CourseProgressReadModel } from '../../domain/course-progress/index.js';

export type CourseProgressReadModelSaveOutcome =
  'created' | 'updated' | 'unchanged' | 'stale';

export interface CourseProgressReadModelSaveResult {
  /**
   * created: no projection existed for this enrollment.
   * updated: a newer snapshot replaced the stored projection.
   * unchanged: the supplied snapshot was already persisted identically.
   * stale: a newer snapshot already exists, so this write was ignored.
   */
  readonly outcome: CourseProgressReadModelSaveOutcome;
  readonly readModel: CourseProgressReadModel;
}

/**
 * Raised when a projection update attempts to associate an existing
 * enrollment with a different CourseVersion.
 *
 * An enrollment's CourseVersion is authoritative; a projection must not
 * silently move it between versions.
 */
export class CourseProgressReadModelVersionConflictError extends Error {
  readonly enrollmentId: string;
  readonly existingCourseVersionId: string;
  readonly incomingCourseVersionId: string;

  constructor(input: {
    readonly enrollmentId: string;
    readonly existingCourseVersionId: string;
    readonly incomingCourseVersionId: string;
  }) {
    super(
      `Course Progress projection for enrollment "${input.enrollmentId}" is already associated with CourseVersion "${input.existingCourseVersionId}" and cannot be reassigned to "${input.incomingCourseVersionId}".`,
    );

    this.name = 'CourseProgressReadModelVersionConflictError';
    this.enrollmentId = input.enrollmentId;
    this.existingCourseVersionId = input.existingCourseVersionId;
    this.incomingCourseVersionId = input.incomingCourseVersionId;
  }
}

export class CourseProgressReadModelTimestampConflictError extends Error {
  readonly enrollmentId: string;
  readonly calculatedAt: Date;

  constructor(input: {
    readonly enrollmentId: string;
    readonly calculatedAt: Date;
  }) {
    super(
      `Course Progress projection for enrollment "${input.enrollmentId}" already has different contents at timestamp "${input.calculatedAt.toISOString()}".`,
    );

    this.name = 'CourseProgressReadModelTimestampConflictError';
    this.enrollmentId = input.enrollmentId;
    this.calculatedAt = new Date(input.calculatedAt.getTime());

    Object.setPrototypeOf(this, new.target.prototype);
  }
}
/**
 * Persistence boundary for the derived Course Progress read model.
 *
 * Implementations must provide atomic, enrollment-scoped upsert semantics.
 * They must not update Enrollment or the authoritative Progress aggregate.
 *
 * Save ordering:
 * - A newer calculatedAt snapshot may replace the current projection.
 * - An older calculatedAt snapshot must not overwrite a newer projection.
 * - An identical snapshot must be treated as idempotent.
 * - Equal timestamps with different projection contents must be resolved
 *   deterministically by the implementation; they must not silently
 *   overwrite one another.
 * - A CourseVersion mismatch for the same enrollment must be rejected.
 *
 * These semantics must be enforced atomically by the persistence
 * implementation, not by an application-level read-then-write sequence.
 */
export interface CourseProgressReadModelRepository {
  findByEnrollmentId(
    enrollmentId: string,
  ): Promise<CourseProgressReadModel | null>;

  save(
    readModel: CourseProgressReadModel,
  ): Promise<CourseProgressReadModelSaveResult>;
}
