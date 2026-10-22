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
 * Resolves a canonical principal only from request.user populated by trusted
 * server-side authentication infrastructure. It never parses credentials.
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

    return createAuthenticatedPrincipal(
      candidate.user.principalId,
      candidate.user,
    );
  }
}
