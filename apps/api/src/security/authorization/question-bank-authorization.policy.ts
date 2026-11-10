import type { AuthenticatedPrincipal } from './authenticated-principal.js';

import {
  QuestionBankAssignmentRole,
  QuestionBankAuthorizationDecisionCode,
  QuestionBankAuthorizationOperation,
  QuestionBankTenantRole,
  type QuestionBankAssignmentRole as QuestionBankAssignmentRoleValue,
  type QuestionBankAuthorizationDecision,
  type QuestionBankAuthorizationOperation as QuestionBankAuthorizationOperationValue,
  type QuestionBankAuthorizationPolicyContract,
  type QuestionBankTenantRole as QuestionBankTenantRoleValue,
} from './question-bank-authorization.types.js';

type AuthorizationRequirements = Readonly<{
  tenantRoles: readonly QuestionBankTenantRoleValue[];
  assignmentRoles: readonly QuestionBankAssignmentRoleValue[];
}>;

/**
 * The approved Question Bank authorization matrix.
 *
 * Tenant roles grant creation and assignment-administration capabilities.
 * Question assignment roles grant resource-level authoring capabilities.
 *
 * Administrative tenant roles do not bypass Question-level assignment
 * requirements for revision or restoration.
 */
export const QUESTION_BANK_AUTHORIZATION_ROLE_MATRIX: Readonly<
  Record<
    QuestionBankAuthorizationOperationValue,
    AuthorizationRequirements
  >
> = Object.freeze({
  [QuestionBankAuthorizationOperation.CREATE_QUESTION]: Object.freeze({
    tenantRoles: Object.freeze([
      QuestionBankTenantRole.TEACHER,
      QuestionBankTenantRole.QUESTION_BANK_ADMIN,
      QuestionBankTenantRole.TENANT_ADMIN,
    ]),
    assignmentRoles: Object.freeze([]),
  }),

  [QuestionBankAuthorizationOperation.REVISE_QUESTION]: Object.freeze({
    tenantRoles: Object.freeze([]),
    assignmentRoles: Object.freeze([
      QuestionBankAssignmentRole.OWNER,
      QuestionBankAssignmentRole.AUTHOR,
      QuestionBankAssignmentRole.CO_AUTHOR,
      QuestionBankAssignmentRole.EDITOR,
    ]),
  }),

  [QuestionBankAuthorizationOperation.RESTORE_QUESTION]: Object.freeze({
    tenantRoles: Object.freeze([]),
    assignmentRoles: Object.freeze([
      QuestionBankAssignmentRole.OWNER,
      QuestionBankAssignmentRole.AUTHOR,
      QuestionBankAssignmentRole.CO_AUTHOR,
      QuestionBankAssignmentRole.EDITOR,
    ]),
  }),

  [QuestionBankAuthorizationOperation.MANAGE_ASSIGNMENTS]: Object.freeze({
    tenantRoles: Object.freeze([
      QuestionBankTenantRole.QUESTION_BANK_ADMIN,
      QuestionBankTenantRole.TENANT_ADMIN,
    ]),
    assignmentRoles: Object.freeze([QuestionBankAssignmentRole.OWNER]),
  }),
});

const VALID_TENANT_ROLES: ReadonlySet<string> = new Set(
  Object.values(QuestionBankTenantRole),
);

const VALID_ASSIGNMENT_ROLES: ReadonlySet<string> = new Set(
  Object.values(QuestionBankAssignmentRole),
);

function normalizeTenantRoles(
  roles: readonly string[] | undefined,
): readonly QuestionBankTenantRoleValue[] {
  if (roles === undefined) {
    return Object.freeze([]);
  }

  return Object.freeze(
    [...new Set(roles)].filter(
      (role): role is QuestionBankTenantRoleValue =>
        VALID_TENANT_ROLES.has(role),
    ),
  );
}

function normalizeAssignmentRoles(
  roles: readonly string[],
): readonly QuestionBankAssignmentRoleValue[] {
  return Object.freeze(
    [...new Set(roles)].filter(
      (role): role is QuestionBankAssignmentRoleValue =>
        VALID_ASSIGNMENT_ROLES.has(role),
    ),
  );
}

/**
 * Pure Question Bank authorization policy.
 *
 * It performs no authentication, HTTP, database, or identity-resolution work.
 * Tenant roles must come from a trusted authenticated membership context.
 * Assignment roles must come from a tenant-scoped persistence lookup.
 */
export class QuestionBankAuthorizationPolicy
  implements QuestionBankAuthorizationPolicyContract
{
  authorize(
    principal: AuthenticatedPrincipal | null,
    operation: QuestionBankAuthorizationOperationValue,
    assignmentRoles: readonly string[] = [],
  ): QuestionBankAuthorizationDecision {
    const requirements =
      QUESTION_BANK_AUTHORIZATION_ROLE_MATRIX[operation];

    if (requirements === undefined) {
      throw new TypeError(
        `Unsupported Question Bank authorization operation: ${String(operation)}`,
      );
    }

    if (principal === null) {
      return Object.freeze({
        allowed: false,
        code: QuestionBankAuthorizationDecisionCode.AUTHENTICATION_REQUIRED,
        operation,
        principalId: null,
        requiredTenantRoles: requirements.tenantRoles,
        actualTenantRoles: Object.freeze([]),
        requiredAssignmentRoles: requirements.assignmentRoles,
        actualAssignmentRoles: Object.freeze([]),
      });
    }

    const actualTenantRoles = normalizeTenantRoles(principal.roles);
    const actualAssignmentRoles =
      normalizeAssignmentRoles(assignmentRoles);

    const tenantRoleAllowed = actualTenantRoles.some((role) =>
      requirements.tenantRoles.includes(role),
    );

    const assignmentRoleAllowed = actualAssignmentRoles.some((role) =>
      requirements.assignmentRoles.includes(role),
    );

    const allowed = tenantRoleAllowed || assignmentRoleAllowed;

    return Object.freeze({
      allowed,
      code: allowed
        ? QuestionBankAuthorizationDecisionCode.ALLOWED
        : QuestionBankAuthorizationDecisionCode.FORBIDDEN,
      operation,
      principalId: principal.principalId,
      requiredTenantRoles: requirements.tenantRoles,
      actualTenantRoles,
      requiredAssignmentRoles: requirements.assignmentRoles,
      actualAssignmentRoles,
    });
  }
}