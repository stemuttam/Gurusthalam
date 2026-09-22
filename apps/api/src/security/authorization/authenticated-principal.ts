/**
 * Canonical authenticated principal used by the API authorization boundary.
 *
 * This is deliberately provider-neutral.
 *
 * Authentication infrastructure is responsible for converting whatever
 * authentication mechanism is used by the platform into this contract.
 *
 * The authorization layer must never depend directly on:
 * - JWT claims
 * - Passport
 * - sessions
 * - OAuth providers
 * - API keys
 * - User database records
 * - Instructor Profile records
 */
export interface AuthenticatedPrincipal {
  readonly authenticated: true;
  readonly principalId: string;
}

/**
 * Creates the canonical authenticated principal.
 *
 * The identifier is intentionally opaque. No UUID assumption is imposed.
 */
export function createAuthenticatedPrincipal(
  principalId: string,
): AuthenticatedPrincipal {
  if (
    typeof principalId !== 'string' ||
    principalId.length === 0 ||
    principalId.trim() !== principalId
  ) {
    throw new TypeError(
      'Authenticated principal identifier must be a non-empty string without leading or trailing whitespace.',
    );
  }

  return Object.freeze({
    authenticated: true as const,
    principalId,
  });
}

/**
 * Determines whether an unknown value already represents the canonical
 * authenticated-principal contract.
 *
 * This function performs structural validation only.
 * It does not authenticate the principal.
 */
export function isAuthenticatedPrincipal(
  value: unknown,
): value is AuthenticatedPrincipal {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const candidate = value as {
    readonly authenticated?: unknown;
    readonly principalId?: unknown;
  };

  return (
    candidate.authenticated === true &&
    typeof candidate.principalId === 'string' &&
    candidate.principalId.length > 0 &&
    candidate.principalId.trim() === candidate.principalId
  );
}
