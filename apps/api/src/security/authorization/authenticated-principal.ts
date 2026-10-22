/**
 * Canonical authenticated principal used by API authorization boundaries.
 *
 * principalId and tenantId are Gurusthalam-owned identifiers. They are never
 * inferred from request headers, route parameters, or an unverified token.
 * Provider-specific claims remain outside this provider-neutral contract.
 */
export interface AuthenticatedPrincipal {
  readonly authenticated: true;
  readonly principalId: string;
  readonly tenantId?: string;
  readonly roles?: readonly string[];
  readonly timezone?: string;
}

export interface AuthenticatedPrincipalContext {
  readonly tenantId?: string;
  readonly roles?: readonly string[];
  readonly timezone?: string;
}

function isNonEmptyIdentifier(value: unknown): value is string {
  return (
    typeof value === 'string' && value.length > 0 && value.trim() === value
  );
}

export function isValidIanaTimeZone(value: unknown): value is string {
  if (!isNonEmptyIdentifier(value)) {
    return false;
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function normalizeContext(
  context?: AuthenticatedPrincipalContext,
): AuthenticatedPrincipalContext {
  if (context === undefined) {
    return {};
  }

  const tenantId = context.tenantId;
  if (tenantId !== undefined && !isNonEmptyIdentifier(tenantId)) {
    throw new TypeError(
      'Authenticated tenant identifier must be a non-empty string without leading or trailing whitespace.',
    );
  }

  const timezone = context.timezone;
  if (timezone !== undefined && !isValidIanaTimeZone(timezone)) {
    throw new TypeError(
      'Authenticated learner timezone must be a valid IANA timezone.',
    );
  }

  const roles = context.roles;
  if (roles !== undefined) {
    if (
      !Array.isArray(roles) ||
      roles.some((role) => !isNonEmptyIdentifier(role))
    ) {
      throw new TypeError(
        'Authenticated principal roles must be non-empty strings without leading or trailing whitespace.',
      );
    }
  }

  return {
    ...(tenantId === undefined ? {} : { tenantId }),
    ...(roles === undefined ? {} : { roles: Object.freeze([...roles]) }),
    ...(timezone === undefined ? {} : { timezone }),
  };
}

/** Creates a defensive, immutable canonical principal. */
export function createAuthenticatedPrincipal(
  principalId: string,
  context?: AuthenticatedPrincipalContext,
): AuthenticatedPrincipal {
  if (!isNonEmptyIdentifier(principalId)) {
    throw new TypeError(
      'Authenticated principal identifier must be a non-empty string without leading or trailing whitespace.',
    );
  }

  return Object.freeze({
    authenticated: true as const,
    principalId,
    ...normalizeContext(context),
  });
}

/**
 * Structural validation only. This function does not authenticate a request.
 * The caller must ensure request.user was set by trusted server middleware.
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
    readonly tenantId?: unknown;
    readonly roles?: unknown;
    readonly timezone?: unknown;
  };

  if (
    candidate.authenticated !== true ||
    !isNonEmptyIdentifier(candidate.principalId)
  ) {
    return false;
  }

  if (
    candidate.tenantId !== undefined &&
    !isNonEmptyIdentifier(candidate.tenantId)
  ) {
    return false;
  }

  if (
    candidate.timezone !== undefined &&
    !isValidIanaTimeZone(candidate.timezone)
  ) {
    return false;
  }

  if (
    candidate.roles !== undefined &&
    (!Array.isArray(candidate.roles) ||
      candidate.roles.some((role) => !isNonEmptyIdentifier(role)))
  ) {
    return false;
  }

  return true;
}
