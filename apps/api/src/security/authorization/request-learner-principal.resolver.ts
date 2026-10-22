import { Injectable } from '@nestjs/common';

import {
  createAuthenticatedLearnerPrincipal,
  isAuthenticatedLearnerPrincipal,
  type AuthenticatedLearnerPrincipal,
} from './authenticated-learner-principal.js';

/**
 * Resolves learner identity established by trusted upstream authentication.
 * It never parses credentials or infers a learner ID from external identity.
 */
@Injectable()
export class RequestLearnerPrincipalResolver {
  resolve(request: unknown): AuthenticatedLearnerPrincipal | null {
    if (request === null || typeof request !== 'object') {
      return null;
    }

    const candidate = request as { readonly user?: unknown };

    if (!isAuthenticatedLearnerPrincipal(candidate.user)) {
      return null;
    }

    return createAuthenticatedLearnerPrincipal(
      candidate.user.principalId,
      candidate.user.learnerId,
      candidate.user,
    );
  }
}
