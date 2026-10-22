import {
  createAuthenticatedPrincipal,
  isAuthenticatedPrincipal,
  type AuthenticatedPrincipalContext,
  type AuthenticatedPrincipal,
} from './authenticated-principal.js';

/**
 * A trusted authenticated principal with an explicitly resolved internal
 * learner identity. Auth0 subject and organization claims are not learner IDs.
 */
export interface AuthenticatedLearnerPrincipal extends AuthenticatedPrincipal {
  readonly learnerId: string;
}

export function createAuthenticatedLearnerPrincipal(
  principalId: string,
  learnerId: string,
  context?: AuthenticatedPrincipalContext,
): AuthenticatedLearnerPrincipal {
  if (
    typeof learnerId !== 'string' ||
    learnerId.length === 0 ||
    learnerId.trim() !== learnerId
  ) {
    throw new TypeError(
      'Authenticated learner identifier must be a non-empty string without leading or trailing whitespace.',
    );
  }

  const principal = createAuthenticatedPrincipal(principalId, context);

  return Object.freeze({
    ...principal,
    learnerId,
  });
}

/** Structural validation only; does not authenticate the supplied identity. */
export function isAuthenticatedLearnerPrincipal(
  value: unknown,
): value is AuthenticatedLearnerPrincipal {
  if (!isAuthenticatedPrincipal(value) || !('learnerId' in value)) {
    return false;
  }

  const candidate = value as { readonly learnerId?: unknown };

  return (
    typeof candidate.learnerId === 'string' &&
    candidate.learnerId.length > 0 &&
    candidate.learnerId.trim() === candidate.learnerId
  );
}
