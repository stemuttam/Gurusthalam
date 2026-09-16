/**
 * Roles that may participate in Course ownership and authoring workflows.
 *
 * These are domain vocabulary only.
 *
 * Authentication, authorization, RBAC, ABAC, permission evaluation,
 * and user/instructor profile resolution remain outside the Course domain.
 *
 * INSTRUCTOR is intentionally not represented here because teaching a Course
 * and authoring/owning its Course definition are distinct concerns.
 */
export const CourseOwnershipRole = Object.freeze({
  OWNER: 'OWNER',
  AUTHOR: 'AUTHOR',
  CO_AUTHOR: 'CO_AUTHOR',
  EDITOR: 'EDITOR',
  REVIEWER: 'REVIEWER',
  PUBLISHER: 'PUBLISHER',
} as const);

export type CourseOwnershipRole =
  (typeof CourseOwnershipRole)[keyof typeof CourseOwnershipRole];

export const COURSE_OWNERSHIP_ROLES = Object.freeze(
  Object.values(CourseOwnershipRole) as readonly CourseOwnershipRole[],
);

export function isCourseOwnershipRole(
  value: unknown,
): value is CourseOwnershipRole {
  return (
    typeof value === 'string' &&
    COURSE_OWNERSHIP_ROLES.includes(value as CourseOwnershipRole)
  );
}
