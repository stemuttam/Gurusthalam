/**
 * Lifecycle status of a CourseVersion.
 *
 * CourseVersion has its own lifecycle contract and is intentionally
 * separate from the Course aggregate lifecycle.
 */
export const CourseVersionStatus = {
  DRAFT: 'DRAFT',
  IN_REVIEW: 'IN_REVIEW',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type CourseVersionStatus =
  (typeof CourseVersionStatus)[keyof typeof CourseVersionStatus];

export const COURSE_VERSION_STATUSES = [
  CourseVersionStatus.DRAFT,
  CourseVersionStatus.IN_REVIEW,
  CourseVersionStatus.PUBLISHED,
  CourseVersionStatus.ARCHIVED,
] as const satisfies readonly CourseVersionStatus[];

export function isCourseVersionStatus(
  value: unknown,
): value is CourseVersionStatus {
  return (
    typeof value === 'string' &&
    COURSE_VERSION_STATUSES.includes(value as CourseVersionStatus)
  );
}