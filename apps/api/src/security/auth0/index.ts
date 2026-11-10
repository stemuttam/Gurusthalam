
export {
  AUTH0_CONFIGURATION,
  loadAuth0Configuration,
  type Auth0Configuration,
} from './auth0-configuration.js';

export {
  Auth0AuthenticationMiddleware,
  hasRequiredScope,
  isEndUserAuth0Identity,
} from './auth0-authentication.middleware.js';

export {
  Auth0QuestionBankAuthenticationMiddleware,
} from './auth0-question-bank-authentication.middleware.js';

export { Auth0AuthenticationModule } from './auth0-authentication.module.js';

export {
  Auth0IdentityResolver,
  type Auth0VerifiedIdentity,
} from './auth0-identity-resolver.js';

export {
  Auth0AuthoringIdentityResolver,
} from './auth0-authoring-identity-resolver.js';
