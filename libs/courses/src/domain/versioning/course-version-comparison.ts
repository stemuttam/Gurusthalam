import type { CourseVersionSnapshot } from './course-version-snapshot.js';

export type CourseVersionSnapshotComparableField =
  | 'courseId'
  | 'version'
  | 'status'
  | 'title'
  | 'description'
  | 'createdAt'
  | 'updatedAt'
  | 'publishedAt';

export interface CourseVersionFieldChange {
  readonly field: CourseVersionSnapshotComparableField;
  readonly before: string | number | null;
  readonly after: string | number | null;
}

export interface CourseVersionComparison {
  readonly leftVersionId: string;
  readonly rightVersionId: string;
  readonly leftVersion: number;
  readonly rightVersion: number;
  readonly sameCourse: boolean;
  readonly changedFields: readonly CourseVersionFieldChange[];
  readonly hasChanges: boolean;
}

/**
 * Compares two CourseVersion snapshots without mutating either snapshot.
 *
 * snapshotSchemaVersion is deliberately excluded from business-field
 * comparison. A schema migration may change the representation without
 * meaning that the CourseVersion itself changed.
 *
 * The comparison remains deterministic because fields are checked in a
 * fixed, explicit order.
 */
export function compareCourseVersionSnapshots(
  left: CourseVersionSnapshot,
  right: CourseVersionSnapshot,
): CourseVersionComparison {
  const changedFields: CourseVersionFieldChange[] = [];

  compareField(changedFields, 'courseId', left.courseId, right.courseId);

  compareField(changedFields, 'version', left.version, right.version);

  compareField(changedFields, 'status', left.status, right.status);

  compareField(changedFields, 'title', left.title, right.title);

  compareField(
    changedFields,
    'description',
    left.description,
    right.description,
  );

  compareField(changedFields, 'createdAt', left.createdAt, right.createdAt);

  compareField(changedFields, 'updatedAt', left.updatedAt, right.updatedAt);

  compareField(
    changedFields,
    'publishedAt',
    left.publishedAt,
    right.publishedAt,
  );

  return Object.freeze({
    leftVersionId: left.id,
    rightVersionId: right.id,
    leftVersion: left.version,
    rightVersion: right.version,
    sameCourse: left.courseId === right.courseId,
    changedFields: Object.freeze(changedFields),
    hasChanges: changedFields.length > 0,
  });
}

function compareField(
  changes: CourseVersionFieldChange[],
  field: CourseVersionSnapshotComparableField,
  before: string | number | null,
  after: string | number | null,
): void {
  if (Object.is(before, after)) {
    return;
  }

  changes.push({
    field,
    before,
    after,
  });
}
