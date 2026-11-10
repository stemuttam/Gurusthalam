import { describe, expect, it } from 'vitest';

import { createAuthenticatedPrincipal } from './authenticated-principal.js';

import {
  QUESTION_BANK_AUTHORIZATION_ROLE_MATRIX,
  QuestionBankAuthorizationPolicy,
} from './question-bank-authorization.policy.js';

import {
  QuestionBankAssignmentRole,
  QuestionBankAuthorizationDecisionCode,
  QuestionBankAuthorizationOperation,
  QuestionBankTenantRole,
} from './question-bank-authorization.types.js';

describe('QuestionBankAuthorizationPolicy', () => {
  const policy = new QuestionBankAuthorizationPolicy();

  it('requires authentication before evaluating permissions', () => {
    const decision = policy.authorize(
      null,
      QuestionBankAuthorizationOperation.CREATE_QUESTION,
    );

    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe(
      QuestionBankAuthorizationDecisionCode.AUTHENTICATION_REQUIRED,
    );
    expect(decision.principalId).toBeNull();
  });

  it.each([
    QuestionBankTenantRole.TEACHER,
    QuestionBankTenantRole.QUESTION_BANK_ADMIN,
    QuestionBankTenantRole.TENANT_ADMIN,
  ])('allows tenant role %s to create a Question', (role) => {
    const decision = policy.authorize(
      createAuthenticatedPrincipal('creator-001', {
        tenantId: 'tenant-001',
        roles: [role],
      }),
      QuestionBankAuthorizationOperation.CREATE_QUESTION,
    );

    expect(decision.allowed).toBe(true);
    expect(decision.code).toBe(
      QuestionBankAuthorizationDecisionCode.ALLOWED,
    );
  });

  it('does not allow a learner to create a Question', () => {
    const decision = policy.authorize(
      createAuthenticatedPrincipal('learner-001', {
        tenantId: 'tenant-001',
        roles: [QuestionBankTenantRole.LEARNER],
      }),
      QuestionBankAuthorizationOperation.CREATE_QUESTION,
    );

    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe(
      QuestionBankAuthorizationDecisionCode.FORBIDDEN,
    );
  });

  it('allows each approved Question assignment role to revise', () => {
    for (const role of Object.values(QuestionBankAssignmentRole)) {
      const decision = policy.authorize(
        createAuthenticatedPrincipal('author-001', {
          tenantId: 'tenant-001',
          roles: [QuestionBankTenantRole.LEARNER],
        }),
        QuestionBankAuthorizationOperation.REVISE_QUESTION,
        [role],
      );

      expect(decision.allowed).toBe(true);
      expect(decision.actualAssignmentRoles).toEqual([role]);
    }
  });

  it('allows each approved Question assignment role to restore', () => {
    for (const role of Object.values(QuestionBankAssignmentRole)) {
      const decision = policy.authorize(
        createAuthenticatedPrincipal('author-001', {
          tenantId: 'tenant-001',
          roles: [],
        }),
        QuestionBankAuthorizationOperation.RESTORE_QUESTION,
        [role],
      );

      expect(decision.allowed).toBe(true);
    }
  });

  it('does not allow an unassigned teacher to revise a Question', () => {
    const decision = policy.authorize(
      createAuthenticatedPrincipal('teacher-001', {
        tenantId: 'tenant-001',
        roles: [QuestionBankTenantRole.TEACHER],
      }),
      QuestionBankAuthorizationOperation.REVISE_QUESTION,
    );

    expect(decision.allowed).toBe(false);
  });

  it('does not allow a tenant administrator to bypass Question assignment for revision', () => {
    const decision = policy.authorize(
      createAuthenticatedPrincipal('tenant-admin-001', {
        tenantId: 'tenant-001',
        roles: [QuestionBankTenantRole.TENANT_ADMIN],
      }),
      QuestionBankAuthorizationOperation.REVISE_QUESTION,
    );

    expect(decision.allowed).toBe(false);
  });

  it('allows an OWNER to manage Question assignments', () => {
    const decision = policy.authorize(
      createAuthenticatedPrincipal('owner-001', {
        tenantId: 'tenant-001',
        roles: [],
      }),
      QuestionBankAuthorizationOperation.MANAGE_ASSIGNMENTS,
      [QuestionBankAssignmentRole.OWNER],
    );

    expect(decision.allowed).toBe(true);
  });

  it.each([
    QuestionBankTenantRole.QUESTION_BANK_ADMIN,
    QuestionBankTenantRole.TENANT_ADMIN,
  ])('allows tenant role %s to manage Question assignments', (role) => {
    const decision = policy.authorize(
      createAuthenticatedPrincipal('admin-001', {
        tenantId: 'tenant-001',
        roles: [role],
      }),
      QuestionBankAuthorizationOperation.MANAGE_ASSIGNMENTS,
    );

    expect(decision.allowed).toBe(true);
  });

  it('does not allow a teacher to manage assignments without OWNER assignment', () => {
    const decision = policy.authorize(
      createAuthenticatedPrincipal('teacher-001', {
        tenantId: 'tenant-001',
        roles: [QuestionBankTenantRole.TEACHER],
      }),
      QuestionBankAuthorizationOperation.MANAGE_ASSIGNMENTS,
    );

    expect(decision.allowed).toBe(false);
  });

  it('ignores unknown tenant and assignment roles', () => {
    const decision = policy.authorize(
      createAuthenticatedPrincipal('unknown-role-actor', {
        tenantId: 'tenant-001',
        roles: ['superuser', QuestionBankTenantRole.LEARNER],
      }),
      QuestionBankAuthorizationOperation.REVISE_QUESTION,
      ['SUPER_OWNER'],
    );

    expect(decision.allowed).toBe(false);
    expect(decision.actualTenantRoles).toEqual([
      QuestionBankTenantRole.LEARNER,
    ]);
    expect(decision.actualAssignmentRoles).toEqual([]);
  });

  it('does not mutate the supplied principal role collection', () => {
    const roles = [
      QuestionBankTenantRole.TEACHER,
      QuestionBankTenantRole.LEARNER,
    ];

    const principal = createAuthenticatedPrincipal('actor-001', {
      tenantId: 'tenant-001',
      roles,
    });

    const before = [...(principal.roles ?? [])];

    policy.authorize(
      principal,
      QuestionBankAuthorizationOperation.CREATE_QUESTION,
    );

    expect(principal.roles).toEqual(before);
  });

  it('publishes the complete approved matrix', () => {
    expect(
      QUESTION_BANK_AUTHORIZATION_ROLE_MATRIX[
        QuestionBankAuthorizationOperation.CREATE_QUESTION
      ].tenantRoles,
    ).toEqual([
      QuestionBankTenantRole.TEACHER,
      QuestionBankTenantRole.QUESTION_BANK_ADMIN,
      QuestionBankTenantRole.TENANT_ADMIN,
    ]);

    expect(
      QUESTION_BANK_AUTHORIZATION_ROLE_MATRIX[
        QuestionBankAuthorizationOperation.MANAGE_ASSIGNMENTS
      ].assignmentRoles,
    ).toEqual([QuestionBankAssignmentRole.OWNER]);
  });
});