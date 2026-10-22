export interface Auth0Configuration {
  /** Origin used by the JWT validator. */
  readonly issuerBaseUrl: string;
  /** Canonical issuer form stored in ExternalIdentity. */
  readonly issuer: string;
  readonly audience: string;
  readonly learnerProgressScope: string;
}

export const AUTH0_CONFIGURATION = Symbol('AUTH0_CONFIGURATION');

/**
 * Loads and validates Auth0 resource-server configuration.
 *
 * A completely unconfigured local/test environment can boot, but the protected
 * route will return 503 (never silently bypass authentication). Partial
 * configuration is always an error; production requires complete settings.
 */
export function loadAuth0Configuration(
  environment: NodeJS.ProcessEnv = process.env,
): Auth0Configuration | null {
  const rawIssuer = environment.AUTH0_ISSUER_BASE_URL?.trim() ?? '';
  const audience = environment.AUTH0_AUDIENCE?.trim() ?? '';
  const learnerProgressScope =
    environment.AUTH0_LEARNING_PROGRESS_SCOPE?.trim() ||
    'read:learning-progress';

  if (rawIssuer.length === 0 && audience.length === 0) {
    if (environment.NODE_ENV === 'production') {
      throw new Error(
        'AUTH0_ISSUER_BASE_URL and AUTH0_AUDIENCE are required in production.',
      );
    }

    return null;
  }

  if (rawIssuer.length === 0 || audience.length === 0) {
    throw new Error(
      'AUTH0_ISSUER_BASE_URL and AUTH0_AUDIENCE must both be configured.',
    );
  }

  if (
    environment.NODE_ENV === 'production' &&
    (/YOUR_AUTH0_DOMAIN/i.test(rawIssuer) ||
      /YOUR_/i.test(audience) ||
      /\.example(?:[/:?#]|$)/i.test(audience))
  ) {
    throw new Error(
      'Production Auth0 configuration still contains example placeholder values.',
    );
  }

  if (!/^[A-Za-z0-9:_./-]{1,256}$/.test(learnerProgressScope)) {
    throw new Error('AUTH0_LEARNING_PROGRESS_SCOPE is invalid.');
  }

  let issuerUrl: URL;
  try {
    issuerUrl = new URL(rawIssuer);
  } catch {
    throw new Error('AUTH0_ISSUER_BASE_URL must be a valid HTTPS URL.');
  }

  if (
    issuerUrl.protocol !== 'https:' ||
    issuerUrl.username.length > 0 ||
    issuerUrl.password.length > 0 ||
    issuerUrl.search.length > 0 ||
    issuerUrl.hash.length > 0 ||
    (issuerUrl.pathname !== '/' && issuerUrl.pathname !== '')
  ) {
    throw new Error(
      'AUTH0_ISSUER_BASE_URL must be an HTTPS issuer origin without credentials, path, query, or fragment.',
    );
  }

  if (audience.length === 0 || audience !== audience.trim()) {
    throw new Error('AUTH0_AUDIENCE must be a non-empty, trimmed identifier.');
  }

  return Object.freeze({
    issuerBaseUrl: issuerUrl.origin,
    issuer: `${issuerUrl.origin}/`,
    audience,
    learnerProgressScope,
  });
}
