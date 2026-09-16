/**
 * Course Author / Instructor Ownership
 *
 * This module defines Course-domain ownership vocabulary and immutable
 * ownership contracts.
 *
 * Authentication, authorization, RBAC, ABAC, User persistence, and
 * Instructor Profile persistence remain outside the Course domain.
 */

export {
  COURSE_OWNERSHIP_ROLES,
  CourseOwnershipRole,
  isCourseOwnershipRole,
} from './enums/course-ownership-role.js';

export { CourseActorId } from './identifiers/course-actor-id.js';

export {
  createCourseOwnershipAssignment,
  rehydrateCourseOwnershipAssignment,
} from './value-objects/course-ownership-assignment.js';

export type { CourseOwnershipAssignmentProps } from './value-objects/course-ownership-assignment.js';

export type { CourseOwnershipRole as CourseOwnershipRoleValue } from './enums/course-ownership-role.js';

export { CourseOwnership } from './value-objects/course-ownership.js';
