/**
 * Lifecycle state of a Course aggregate.
 *
 * CourseStatus represents the business lifecycle of a course.
 * It is intentionally independent of persistence and transport concerns.
 */
export const CourseStatus = {
  DRAFT: 'DRAFT',
  IN_REVIEW: 'IN_REVIEW',
  PUBLISHED: 'PUBLISHED',
  UNPUBLISHED: 'UNPUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type CourseStatus =
  (typeof CourseStatus)[keyof typeof CourseStatus];

export const COURSE_STATUSES = Object.values(CourseStatus) as readonly CourseStatus[];

export function isCourseStatus(value: unknown): value is CourseStatus {
  return (
    typeof value === 'string' &&
    COURSE_STATUSES.includes(value as CourseStatus)
  );
}