/**
 * Tenant membership roles recognized by Question Bank authorization.
 *
 * These are persisted as strings on PrincipalTenantMembership.roles.
 * Unknown role strings never grant Question Bank permissions.
 */
export const QuestionBankTenantRole = Object.freeze({
  TEACHER: 'teacher',
  QUESTION_BANK_ADMIN: 'question_bank_admin',
  TENANT_ADMIN: 'tenant_admin',
  LEARNER: 'learner',
} as const);

export type QuestionBankTenantRole =
  (typeof QuestionBankTenantRole)[keyof typeof QuestionBankTenantRole];

/**
 * Question-level collaboration roles.
 *
 * This vocabulary intentionally matches the approved subset of Course
 * ownership roles without making Question Bank authorization dependent
 * on the Course application service.
 */
export const QuestionBankAssignmentRole = Object.freeze({
  OWNER: 'OWNER',
  AUTHOR: 'AUTHOR',
  CO_AUTHOR: 'CO_AUTHOR',
  EDITOR: 'EDITOR',
} as const);

export type QuestionBankAssignmentRole =
  (typeof QuestionBankAssignmentRole)[keyof typeof QuestionBankAssignmentRole];

/** Operations evaluated by the Question Bank authorization boundary. */
export const QuestionBankAuthorizationOperation = Object.freeze({
  CREATE_QUESTION: 'CREATE_QUESTION',
  REVISE_QUESTION: 'REVISE_QUESTION',
  RESTORE_QUESTION: 'RESTORE_QUESTION',
  MANAGE_ASSIGNMENTS: 'MANAGE_ASSIGNMENTS',
} as const);

export type QuestionBankAuthorizationOperation =
  (typeof QuestionBankAuthorizationOperation)[keyof typeof QuestionBankAuthorizationOperation];

/** Stable authorization decision codes. */
export const QuestionBankAuthorizationDecisionCode = Object.freeze({
  ALLOWED: 'ALLOWED',
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  FORBIDDEN: 'FORBIDDEN',
} as const);

export type QuestionBankAuthorizationDecisionCode =
  (typeof QuestionBankAuthorizationDecisionCode)[keyof typeof QuestionBankAuthorizationDecisionCode];

export interface QuestionBankAuthorizationDecision {
  readonly allowed: boolean;
  readonly code: QuestionBankAuthorizationDecisionCode;
  readonly operation: QuestionBankAuthorizationOperation;
  readonly principalId: string | null;
  readonly requiredTenantRoles: readonly QuestionBankTenantRole[];
  readonly actualTenantRoles: readonly QuestionBankTenantRole[];
  readonly requiredAssignmentRoles: readonly QuestionBankAssignmentRole[];
  readonly actualAssignmentRoles: readonly QuestionBankAssignmentRole[];
}

export interface QuestionBankAuthorizationPolicyContract {
  authorize(
    principal: {
      readonly authenticated: true;
      readonly principalId: string;
      readonly roles?: readonly string[];
    } | null,
    operation: QuestionBankAuthorizationOperation,
    assignmentRoles?: readonly string[],
  ): QuestionBankAuthorizationDecision;
}