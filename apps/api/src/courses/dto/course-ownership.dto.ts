import type { CourseOwnershipRole } from '@gurusthalam/courses';

/**
 * HTTP transport contract for assigning one ownership role.
 *
 * courseId is supplied by the route parameter.
 */
export interface AssignCourseOwnershipDto {
  readonly principalId: string;

  readonly role: CourseOwnershipRole;
}

/**
 * HTTP transport contract for removing one ownership role.
 *
 * courseId is supplied by the route parameter.
 */
export interface RemoveCourseOwnershipDto {
  readonly principalId: string;

  readonly role: CourseOwnershipRole;
}

/**
 * HTTP transport contract for replacing the complete ownership
 * collection of a Course.
 *
 * courseId is supplied by the route parameter.
 */
export interface ReplaceCourseOwnershipDto {
  readonly assignments: readonly CourseOwnershipAssignmentDto[];
}

/**
 * HTTP transport representation of one ownership assignment.
 */
export interface CourseOwnershipAssignmentDto {
  readonly principalId: string;

  readonly role: CourseOwnershipRole;
}
