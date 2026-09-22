import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import type { Course } from '@gurusthalam/courses';

import type { AuthenticatedPrincipal } from './authenticated-principal.js';

import { CourseAuthorizationPolicy } from './course-authorization.policy.js';

import {
  CourseAuthorizationDecisionCode,
  type CourseAuthorizationDecision,
  type CourseAuthorizationOperation,
} from './course-authorization.types.js';

/**
 * API authorization enforcement boundary.
 *
 * The policy remains pure.
 * This service translates the policy decision into HTTP-independent
 * authorization behavior for the API layer.
 *
 * HTTP exception mapping is kept here rather than inside the Course domain.
 */
@Injectable()
export class CourseAuthorizationService {
  constructor(private readonly policy: CourseAuthorizationPolicy) {}

  authorize(
    principal: AuthenticatedPrincipal | null,
    course: Course,
    operation: CourseAuthorizationOperation,
  ): CourseAuthorizationDecision {
    return this.policy.authorize(principal, course, operation);
  }

  assertAuthorized(
    principal: AuthenticatedPrincipal | null,
    course: Course,
    operation: CourseAuthorizationOperation,
  ): CourseAuthorizationDecision {
    const decision = this.authorize(principal, course, operation);

    if (
      decision.code === CourseAuthorizationDecisionCode.AUTHENTICATION_REQUIRED
    ) {
      throw new UnauthorizedException(
        'Authentication is required to perform this Course operation.',
      );
    }

    if (decision.code === CourseAuthorizationDecisionCode.FORBIDDEN) {
      throw new ForbiddenException(
        'The authenticated principal is not authorized to perform this Course operation.',
      );
    }

    return decision;
  }
}
