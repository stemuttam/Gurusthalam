import { describe, expect, it } from 'vitest';

import { QuestionOwnership } from './question-ownership.js';

describe('QuestionOwnership', () => {
  it('creates immutable tenant ownership', () => {
    const ownership = QuestionOwnership.create(
      'tenant-001',
      'principal-001',
    );

    expect(ownership.tenantId).toBe('tenant-001');
    expect(ownership.createdByPrincipalId).toBe('principal-001');
    expect(Object.isFrozen(ownership)).toBe(true);
  });

  it('compares ownership by both identifiers', () => {
    const first = QuestionOwnership.create('tenant-001', 'principal-001');
    const equivalent = QuestionOwnership.create(
      'tenant-001',
      'principal-001',
    );
    const otherTenant = QuestionOwnership.create(
      'tenant-002',
      'principal-001',
    );
    const otherPrincipal = QuestionOwnership.create(
      'tenant-001',
      'principal-002',
    );

    expect(first.equals(equivalent)).toBe(true);
    expect(first.equals(otherTenant)).toBe(false);
    expect(first.equals(otherPrincipal)).toBe(false);
  });

  it.each([
    ['', 'principal-001'],
    ['   ', 'principal-001'],
    [' tenant-001', 'principal-001'],
    ['tenant-001 ', 'principal-001'],
    ['tenant-001', ''],
    ['tenant-001', '   '],
    ['tenant-001', ' principal-001'],
    ['tenant-001', 'principal-001 '],
  ])('rejects invalid ownership identifiers', (tenantId, principalId) => {
    expect(() =>
      QuestionOwnership.create(tenantId, principalId),
    ).toThrow(TypeError);
  });
});