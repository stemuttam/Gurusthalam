import type {
  CourseLevel,
  CourseType,
  CourseVisibility,
  CourseOwnershipRole,
} from '@gurusthalam/courses';

/**
 * HTTP transport contract for creating a Course.
 *
 * This is intentionally limited to transport-level primitives.
 * Runtime validation is performed by the canonical Course application
 * schema before the request reaches the application service.
 *
 * Authentication and authorization are deliberately excluded.
 */
export interface CreateCourseDto {
  readonly title: string;

  readonly description?: string | null;

  readonly level: CourseLevel;

  readonly type: CourseType;

  readonly visibility?: CourseVisibility;

  readonly instructorId: string;

  readonly ownership?: readonly CourseOwnershipAssignmentDto[];
}

/**
 * HTTP transport representation of one Course ownership assignment.
 *
 * Domain value-object construction remains outside this DTO.
 */
export interface CourseOwnershipAssignmentDto {
  readonly principalId: string;

  readonly role: CourseOwnershipRole;
}
