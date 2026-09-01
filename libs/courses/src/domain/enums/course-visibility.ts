/**
 * Controls how a Course is discoverable by learners.
 *
 * Visibility is intentionally separate from CourseStatus.
 *
 * Example:
 * - A PUBLISHED course may be PUBLIC.
 * - A PUBLISHED course may be UNLISTED.
 * - A DRAFT course should not be exposed publicly regardless of visibility.
 */
export const CourseVisibility = {
  PRIVATE: 'PRIVATE',
  UNLISTED: 'UNLISTED',
  PUBLIC: 'PUBLIC',
} as const;

export type CourseVisibility =
  (typeof CourseVisibility)[keyof typeof CourseVisibility];

export const COURSE_VISIBILITIES =
  Object.values(CourseVisibility) as readonly CourseVisibility[];

export function isCourseVisibility(
  value: unknown,
): value is CourseVisibility {
  return (
    typeof value === 'string' &&
    COURSE_VISIBILITIES.includes(value as CourseVisibility)
  );
}