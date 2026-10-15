import {
  createAuthenticatedPrincipal,
  isAuthenticatedPrincipal,
  type AuthenticatedPrincipal,
} from './authenticated-principal.js';

/**
 * A trusted authenticated principal with an explicitly resolved learner
 * identity. `principalId` and `learnerId` are separate identifiers.
 *
 * Authentication infrastructure must establish this relationship before
 * placing this contract on request.user. Structural validation alone does
 * not authenticate a request.
 */
export interface AuthenticatedLearnerPrincipal extends AuthenticatedPrincipal {
  readonly learnerId: string;
}

export function createAuthenticatedLearnerPrincipal(
  principalId: string,
  learnerId: string,
): AuthenticatedLearnerPrincipal {
  const principal = createAuthenticatedPrincipal(principalId);

  if (
    typeof learnerId !== 'string' ||
    learnerId.length === 0 ||
    learnerId.trim() !== learnerId
  ) {
    throw new TypeError(
      'Authenticated learner identifier must be a non-empty string without leading or trailing whitespace.',
    );
  }

  return Object.freeze({
    ...principal,
    learnerId,
  });
}

/**
 * Performs structural validation only. The caller must obtain request.user
 * from trusted authentication infrastructure, never from client input.
 */
export function isAuthenticatedLearnerPrincipal(
  value: unknown,
): value is AuthenticatedLearnerPrincipal {
  if (!isAuthenticatedPrincipal(value) || !('learnerId' in value)) {
    return false;
  }

  const candidate = value as {
    readonly learnerId?: unknown;
  };

  return (
    typeof candidate.learnerId === 'string' &&
    candidate.learnerId.length > 0 &&
    candidate.learnerId.trim() === candidate.learnerId
  );
}
