import type { CourseOwnershipRole } from '@gurusthalam/courses';

/**
 * Operations that are authorized against an existing Course.
 *
 * Course creation is intentionally excluded because no Course ownership
 * relationship exists before the Course is created.
 *
 * Course creation authorization belongs to the broader platform
 * authorization boundary.
 */
export const CourseAuthorizationOperation = Object.freeze({
  READ: 'READ',
  UPDATE_METADATA: 'UPDATE_METADATA',
  ASSIGN_OWNERSHIP: 'ASSIGN_OWNERSHIP',
  REMOVE_OWNERSHIP: 'REMOVE_OWNERSHIP',
  REPLACE_OWNERSHIP: 'REPLACE_OWNERSHIP',
  SUBMIT_FOR_REVIEW: 'SUBMIT_FOR_REVIEW',
  REQUEST_CHANGES: 'REQUEST_CHANGES',
  PUBLISH: 'PUBLISH',
  UNPUBLISH: 'UNPUBLISH',
  ARCHIVE: 'ARCHIVE',
  CREATE_VERSION: 'CREATE_VERSION',
  PUBLISH_VERSION: 'PUBLISH_VERSION',
} as const);

export type CourseAuthorizationOperation =
  (typeof CourseAuthorizationOperation)[keyof typeof CourseAuthorizationOperation];

/**
 * Result classification returned by the authorization policy.
 */
export const CourseAuthorizationDecisionCode = Object.freeze({
  ALLOWED: 'ALLOWED',
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  FORBIDDEN: 'FORBIDDEN',
} as const);

export type CourseAuthorizationDecisionCode =
  (typeof CourseAuthorizationDecisionCode)[keyof typeof CourseAuthorizationDecisionCode];

/**
 * Immutable authorization decision.
 */
export interface CourseAuthorizationDecision {
  readonly allowed: boolean;
  readonly code: CourseAuthorizationDecisionCode;
  readonly operation: CourseAuthorizationOperation;
  readonly principalId: string | null;
  readonly requiredRoles: readonly CourseOwnershipRole[];
  readonly actualRoles: readonly CourseOwnershipRole[];
}

/**
 * Pure Course authorization policy contract.
 */
export interface CourseAuthorizationPolicyContract {
  authorize(
    principal: {
      readonly principalId: string;
      readonly authenticated: true;
    } | null,
    course: {
      readonly ownership: {
        readonly getAssignments: () => readonly {
          readonly principalId: {
            readonly toString: () => string;
          };
          readonly role: CourseOwnershipRole;
        }[];
      };
    },
    operation: CourseAuthorizationOperation,
  ): CourseAuthorizationDecision;
}
