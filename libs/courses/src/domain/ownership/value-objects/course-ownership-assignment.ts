import { CourseValidationError } from '../../errors/index.js';
import {
  CourseOwnershipRole,
  isCourseOwnershipRole,
} from '../enums/course-ownership-role.js';
import { CourseActorId } from '../identifiers/course-actor-id.js';

/**
 * Immutable assignment of a Course participant to an ownership/workflow role.
 *
 * This object describes domain vocabulary only.
 *
 * It does not determine:
 * - whether the actor exists,
 * - whether the actor is authenticated,
 * - whether the actor is authorized,
 * - whether RBAC/ABAC permits an action,
 * - whether an Instructor Profile exists.
 *
 * Those concerns belong to identity and application/authorization layers.
 */
export interface CourseOwnershipAssignmentProps {
  readonly principalId: CourseActorId;
  readonly role: CourseOwnershipRole;
}

/**
 * Creates an immutable Course ownership assignment.
 */
export function createCourseOwnershipAssignment(
  input: CourseOwnershipAssignmentProps,
): CourseOwnershipAssignmentProps {
  validatePrincipalId(input.principalId);
  validateRole(input.role);

  return Object.freeze({
    principalId: input.principalId,
    role: input.role,
  });
}

/**
 * Rehydrates an existing immutable Course ownership assignment.
 *
 * Rehydration preserves the supplied actor identity and role without
 * generating or mutating external identity state.
 */
export function rehydrateCourseOwnershipAssignment(
  props: CourseOwnershipAssignmentProps,
): CourseOwnershipAssignmentProps {
  validatePrincipalId(props.principalId);
  validateRole(props.role);

  return Object.freeze({
    principalId: props.principalId,
    role: props.role,
  });
}

function validatePrincipalId(principalId: CourseActorId): void {
  if (!(principalId instanceof CourseActorId)) {
    throw new CourseValidationError(
      'Course ownership assignment validation failed.',
      [
        {
          field: 'principalId',
          message:
            'Course ownership principal identifier must be a CourseActorId.',
        },
      ],
    );
  }
}

function validateRole(role: CourseOwnershipRole): void {
  if (!isCourseOwnershipRole(role)) {
    throw new CourseValidationError(
      'Course ownership assignment validation failed.',
      [
        {
          field: 'role',
          message:
            'Course ownership role must be a supported CourseOwnershipRole.',
        },
      ],
    );
  }
}
