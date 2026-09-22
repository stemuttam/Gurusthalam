import { describe, expect, it } from 'vitest';

import { createAuthenticatedPrincipal } from './authenticated-principal.js';

import { RequestPrincipalResolver } from './request-principal.resolver.js';

describe('RequestPrincipalResolver', () => {
  const resolver = new RequestPrincipalResolver();

  it('resolves the canonical principal from request.user', () => {
    const request = {
      user: createAuthenticatedPrincipal('actor-001'),
    };

    expect(resolver.resolve(request)).toEqual({
      authenticated: true,
      principalId: 'actor-001',
    });
  });

  it('creates a defensive canonical principal from a structurally valid request user', () => {
    const request = {
      user: {
        authenticated: true,
        principalId: 'actor-002',
        unexpectedClaim: 'ignored',
      },
    };

    const principal = resolver.resolve(request);

    expect(principal).toEqual({
      authenticated: true,
      principalId: 'actor-002',
    });

    expect(principal).not.toBe(request.user);
  });

  it('returns null when request.user is missing', () => {
    expect(resolver.resolve({})).toBeNull();
  });

  it('returns null when request is not an object', () => {
    expect(resolver.resolve(null)).toBeNull();

    expect(resolver.resolve(undefined)).toBeNull();

    expect(resolver.resolve('request')).toBeNull();
  });

  it('returns null when request.user is unauthenticated', () => {
    expect(
      resolver.resolve({
        user: {
          authenticated: false,
          principalId: 'actor-003',
        },
      }),
    ).toBeNull();
  });

  it('returns null when request.user has no principal identifier', () => {
    expect(
      resolver.resolve({
        user: {
          authenticated: true,
        },
      }),
    ).toBeNull();
  });

  it('returns null when request.user has an invalid principal identifier', () => {
    expect(
      resolver.resolve({
        user: {
          authenticated: true,
          principalId: ' actor-004',
        },
      }),
    ).toBeNull();

    expect(
      resolver.resolve({
        user: {
          authenticated: true,
          principalId: '',
        },
      }),
    ).toBeNull();
  });

  it('does not infer identity from arbitrary request headers', () => {
    expect(
      resolver.resolve({
        headers: {
          'x-user-id': 'actor-005',
          authorization: 'Bearer arbitrary-value',
        },
      }),
    ).toBeNull();
  });
});
