export {
  createAuthenticatedPrincipal,
  isAuthenticatedPrincipal,
  isValidIanaTimeZone,
} from './authenticated-principal.js';

export type {
  AuthenticatedPrincipal,
  AuthenticatedPrincipalContext,
} from './authenticated-principal.js';

export {
  createAuthenticatedLearnerPrincipal,
  isAuthenticatedLearnerPrincipal,
} from './authenticated-learner-principal.js';

export type { AuthenticatedLearnerPrincipal } from './authenticated-learner-principal.js';

export type { PrincipalResolver } from './principal-resolver.js';
export { RequestPrincipalResolver } from './request-principal.resolver.js';
export { RequestLearnerPrincipalResolver } from './request-learner-principal.resolver.js';

export {
  COURSE_AUTHORIZATION_ROLE_MATRIX,
  CourseAuthorizationPolicy,
} from './course-authorization.policy.js';

export { CourseAuthorizationService } from './course-authorization.service.js';
export { CourseAuthorizationModule } from './course-authorization.module.js';

export {
  CourseAuthorizationDecisionCode,
  CourseAuthorizationOperation,
} from './course-authorization.types.js';

export type {
  CourseAuthorizationDecision,
  CourseAuthorizationOperation as CourseAuthorizationOperationValue,
  CourseAuthorizationPolicyContract,
} from './course-authorization.types.js';
