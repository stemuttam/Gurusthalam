
export interface Auth0Configuration {
  /** Origin used by the JWT validator. */
  readonly issuerBaseUrl: string;
  /** Canonical issuer form stored in ExternalIdentity. */
  readonly issuer: string;
  readonly audience: string;
  readonly learnerProgressScope: string;
  readonly questionBankWriteScope: string;
  readonly questionBankAssignmentManagementScope: string;
}

export const AUTH0_CONFIGURATION = Symbol('AUTH0_CONFIGURATION');

const DEFAULT_LEARNER_PROGRESS_SCOPE = 'read:learning-progress';
const DEFAULT_QUESTION_BANK_WRITE_SCOPE = 'write:question-bank';
const DEFAULT_QUESTION_BANK_ASSIGNMENT_SCOPE =
  'manage:question-bank-access';

function validateScope(value: string, environmentName: string): void {
  if (!/^[A-Za-z0-9:_./-]{1,256}$/.test(value)) {
    throw new Error(`${environmentName} is invalid.`);
  }
}

/**
 * Loads and validates Auth0 resource-server configuration.
 *
 * A completely unconfigured local/test environment can boot, but protected
 * routes return 503. Partial configuration is always an error; production
 * requires complete issuer and audience settings.
 */
export function loadAuth0Configuration(
  environment: NodeJS.ProcessEnv = process.env,
): Auth0Configuration | null {
  const rawIssuer = environment.AUTH0_ISSUER_BASE_URL?.trim() ?? '';
  const audience = environment.AUTH0_AUDIENCE?.trim() ?? '';

  const learnerProgressScope =
    environment.AUTH0_LEARNING_PROGRESS_SCOPE?.trim() ||
    DEFAULT_LEARNER_PROGRESS_SCOPE;

  const questionBankWriteScope =
    environment.AUTH0_QUESTION_BANK_WRITE_SCOPE?.trim() ||
    DEFAULT_QUESTION_BANK_WRITE_SCOPE;

  const questionBankAssignmentManagementScope =
    environment.AUTH0_QUESTION_BANK_ASSIGNMENT_MANAGEMENT_SCOPE?.trim() ||
    DEFAULT_QUESTION_BANK_ASSIGNMENT_SCOPE;

  validateScope(
    learnerProgressScope,
    'AUTH0_LEARNING_PROGRESS_SCOPE',
  );
  validateScope(
    questionBankWriteScope,
    'AUTH0_QUESTION_BANK_WRITE_SCOPE',
  );
  validateScope(
    questionBankAssignmentManagementScope,
    'AUTH0_QUESTION_BANK_ASSIGNMENT_MANAGEMENT_SCOPE',
  );

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
    questionBankWriteScope,
    questionBankAssignmentManagementScope,
  });
}
