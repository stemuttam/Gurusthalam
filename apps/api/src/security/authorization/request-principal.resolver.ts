import { Injectable } from '@nestjs/common';

import {
  createAuthenticatedPrincipal,
  isAuthenticatedPrincipal,
  type AuthenticatedPrincipal,
} from './authenticated-principal.js';

import type { PrincipalResolver } from './principal-resolver.js';

interface RequestWithOptionalUser {
  readonly user?: unknown;
}

/**
 * Resolves the canonical authenticated principal from request.user.
 *
 * Authentication infrastructure is expected to populate request.user with
 * the canonical AuthenticatedPrincipal contract.
 *
 * This class intentionally does not:
 * - inspect authorization headers;
 * - parse JWTs;
 * - validate API keys;
 * - query users;
 * - query instructor profiles;
 * - infer identity from arbitrary client-controlled headers.
 *
 * Until an authentication adapter populates request.user, resolution
 * correctly returns null.
 */
@Injectable()
export class RequestPrincipalResolver implements PrincipalResolver {
  resolve(request: unknown): AuthenticatedPrincipal | null {
    if (request === null || typeof request !== 'object') {
      return null;
    }

    const candidate = request as RequestWithOptionalUser;

    if (!isAuthenticatedPrincipal(candidate.user)) {
      return null;
    }

    return createAuthenticatedPrincipal(candidate.user.principalId);
  }
}
