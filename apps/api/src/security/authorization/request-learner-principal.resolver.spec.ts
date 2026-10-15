import { describe, expect, it } from 'vitest';

import { createAuthenticatedLearnerPrincipal } from './authenticated-learner-principal.js';

import { RequestLearnerPrincipalResolver } from './request-learner-principal.resolver.js';

describe('RequestLearnerPrincipalResolver', () => {
  const resolver = new RequestLearnerPrincipalResolver();

  it('resolves an authenticated learner from trusted request.user', () => {
    const request = {
      user: createAuthenticatedLearnerPrincipal('principal-001', 'learner-001'),
    };

    expect(resolver.resolve(request)).toEqual({
      authenticated: true,
      principalId: 'principal-001',
      learnerId: 'learner-001',
    });
  });

  it('returns a defensive canonical copy', () => {
    const request = {
      user: {
        authenticated: true,
        principalId: 'principal-002',
        learnerId: 'learner-002',
        unexpectedClaim: 'ignored',
      },
    };

    const principal = resolver.resolve(request);

    expect(principal).toEqual({
      authenticated: true,
      principalId: 'principal-002',
      learnerId: 'learner-002',
    });

    expect(principal).not.toBe(request.user);
  });

  it('rejects a principal without a learner identity', () => {
    expect(
      resolver.resolve({
        user: {
          authenticated: true,
          principalId: 'principal-003',
        },
      }),
    ).toBeNull();
  });

  it('rejects malformed learner identities', () => {
    for (const learnerId of ['', ' learner-004', 'learner-004 ']) {
      expect(
        resolver.resolve({
          user: {
            authenticated: true,
            principalId: 'principal-004',
            learnerId,
          },
        }),
      ).toBeNull();
    }
  });

  it('does not infer identity from request headers', () => {
    expect(
      resolver.resolve({
        headers: {
          'x-learner-id': 'learner-005',
          'x-principal-id': 'principal-005',
        },
      }),
    ).toBeNull();
  });

  it('rejects missing, unauthenticated, and invalid requests', () => {
    expect(resolver.resolve(null)).toBeNull();
    expect(resolver.resolve(undefined)).toBeNull();
    expect(resolver.resolve({})).toBeNull();

    expect(
      resolver.resolve({
        user: {
          authenticated: false,
          principalId: 'principal-006',
          learnerId: 'learner-006',
        },
      }),
    ).toBeNull();
  });
});
