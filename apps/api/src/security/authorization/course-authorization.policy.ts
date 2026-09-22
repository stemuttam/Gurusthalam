import {
  CourseAuthorizationDecisionCode,
  CourseAuthorizationOperation,
  type CourseAuthorizationDecision,
  type CourseAuthorizationOperation as CourseAuthorizationOperationValue,
  type CourseAuthorizationPolicyContract,
} from './course-authorization.types.js';

import type { AuthenticatedPrincipal } from './authenticated-principal.js';

import {
  CourseOwnershipRole,
  type CourseOwnershipRole as CourseOwnershipRoleValue,
  type Course,
} from '@gurusthalam/courses';

type CourseAuthorizationRoleMatrix = Readonly<
  Record<CourseAuthorizationOperationValue, readonly CourseOwnershipRoleValue[]>
>;

/**
 * Approved Course authorization matrix for 4.11-F.
 *
 * This matrix is the API authorization policy.
 *
 * Domain ownership vocabulary remains in the Course domain.
 * Permission semantics remain here in the API authorization boundary.
 */
export const COURSE_AUTHORIZATION_ROLE_MATRIX: CourseAuthorizationRoleMatrix =
  Object.freeze({
    [CourseAuthorizationOperation.READ]: Object.freeze([
      CourseOwnershipRole.OWNER,
      CourseOwnershipRole.AUTHOR,
      CourseOwnershipRole.CO_AUTHOR,
      CourseOwnershipRole.EDITOR,
      CourseOwnershipRole.REVIEWER,
      CourseOwnershipRole.PUBLISHER,
    ]),

    [CourseAuthorizationOperation.UPDATE_METADATA]: Object.freeze([
      CourseOwnershipRole.OWNER,
      CourseOwnershipRole.AUTHOR,
      CourseOwnershipRole.CO_AUTHOR,
      CourseOwnershipRole.EDITOR,
    ]),

    [CourseAuthorizationOperation.ASSIGN_OWNERSHIP]: Object.freeze([
      CourseOwnershipRole.OWNER,
    ]),

    [CourseAuthorizationOperation.REMOVE_OWNERSHIP]: Object.freeze([
      CourseOwnershipRole.OWNER,
    ]),

    [CourseAuthorizationOperation.REPLACE_OWNERSHIP]: Object.freeze([
      CourseOwnershipRole.OWNER,
    ]),

    [CourseAuthorizationOperation.SUBMIT_FOR_REVIEW]: Object.freeze([
      CourseOwnershipRole.OWNER,
      CourseOwnershipRole.AUTHOR,
      CourseOwnershipRole.CO_AUTHOR,
      CourseOwnershipRole.EDITOR,
    ]),

    [CourseAuthorizationOperation.REQUEST_CHANGES]: Object.freeze([
      CourseOwnershipRole.OWNER,
      CourseOwnershipRole.REVIEWER,
    ]),

    [CourseAuthorizationOperation.PUBLISH]: Object.freeze([
      CourseOwnershipRole.OWNER,
      CourseOwnershipRole.PUBLISHER,
    ]),

    [CourseAuthorizationOperation.UNPUBLISH]: Object.freeze([
      CourseOwnershipRole.OWNER,
      CourseOwnershipRole.PUBLISHER,
    ]),

    [CourseAuthorizationOperation.ARCHIVE]: Object.freeze([
      CourseOwnershipRole.OWNER,
    ]),

    [CourseAuthorizationOperation.CREATE_VERSION]: Object.freeze([
      CourseOwnershipRole.OWNER,
      CourseOwnershipRole.AUTHOR,
      CourseOwnershipRole.CO_AUTHOR,
      CourseOwnershipRole.EDITOR,
    ]),

    [CourseAuthorizationOperation.PUBLISH_VERSION]: Object.freeze([
      CourseOwnershipRole.OWNER,
      CourseOwnershipRole.PUBLISHER,
    ]),
  });

/**
 * Pure Course authorization policy.
 *
 * This class deliberately contains no NestJS, HTTP, persistence,
 * authentication, or identity-resolution logic.
 */
export class CourseAuthorizationPolicy implements CourseAuthorizationPolicyContract {
  authorize(
    principal: AuthenticatedPrincipal | null,
    course: Course,
    operation: CourseAuthorizationOperationValue,
  ): CourseAuthorizationDecision {
    const requiredRoles = COURSE_AUTHORIZATION_ROLE_MATRIX[operation];

    if (requiredRoles === undefined) {
      throw new TypeError(
        `Unsupported Course authorization operation: ${String(operation)}`,
      );
    }

    if (principal === null) {
      return Object.freeze({
        allowed: false,
        code: CourseAuthorizationDecisionCode.AUTHENTICATION_REQUIRED,
        operation,
        principalId: null,
        requiredRoles,
        actualRoles: Object.freeze([]),
      });
    }

    const actualRoles = Object.freeze(
      course.ownership
        .getAssignments()
        .filter(
          (assignment) =>
            assignment.principalId.toString() === principal.principalId,
        )
        .map((assignment) => assignment.role),
    );

    const allowed = actualRoles.some((role) => requiredRoles.includes(role));

    return Object.freeze({
      allowed,
      code: allowed
        ? CourseAuthorizationDecisionCode.ALLOWED
        : CourseAuthorizationDecisionCode.FORBIDDEN,
      operation,
      principalId: principal.principalId,
      requiredRoles,
      actualRoles,
    });
  }
}
