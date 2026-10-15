import { Injectable } from '@nestjs/common';

import {
  createAuthenticatedLearnerPrincipal,
  isAuthenticatedLearnerPrincipal,
  type AuthenticatedLearnerPrincipal,
} from './authenticated-learner-principal.js';

/**
 * Resolves a learner principal established by upstream authentication.
 *
 * This resolver deliberately does not:
 * - authenticate credentials;
 * - parse JWTs or sessions;
 * - inspect arbitrary request headers;
 * - infer learnerId from principalId;
 * - accept learner identity from route parameters or query strings.
 *
 * Missing or invalid trusted identity fails closed.
 */
@Injectable()
export class RequestLearnerPrincipalResolver {
  resolve(request: unknown): AuthenticatedLearnerPrincipal | null {
    if (request === null || typeof request !== 'object') {
      return null;
    }

    const candidate = request as {
      readonly user?: unknown;
    };

    if (!isAuthenticatedLearnerPrincipal(candidate.user)) {
      return null;
    }

    return createAuthenticatedLearnerPrincipal(
      candidate.user.principalId,
      candidate.user.learnerId,
    );
  }
}
