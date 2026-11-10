import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import type { AuthenticatedPrincipal } from './authenticated-principal.js';

import { QuestionBankAuthorizationPolicy } from './question-bank-authorization.policy.js';

import {
  QuestionBankAuthorizationDecisionCode,
  type QuestionBankAuthorizationDecision,
  type QuestionBankAuthorizationOperation,
} from './question-bank-authorization.types.js';

/**
 * API enforcement boundary for Question Bank authorization.
 *
 * The policy remains pure and independently testable. This service maps
 * authorization decisions to NestJS HTTP exceptions.
 */
@Injectable()
export class QuestionBankAuthorizationService {
  constructor(
    private readonly policy: QuestionBankAuthorizationPolicy,
  ) {}

  authorize(
    principal: AuthenticatedPrincipal | null,
    operation: QuestionBankAuthorizationOperation,
    assignmentRoles: readonly string[] = [],
  ): QuestionBankAuthorizationDecision {
    return this.policy.authorize(
      principal,
      operation,
      assignmentRoles,
    );
  }

  assertAuthorized(
    principal: AuthenticatedPrincipal | null,
    operation: QuestionBankAuthorizationOperation,
    assignmentRoles: readonly string[] = [],
  ): QuestionBankAuthorizationDecision {
    const decision = this.authorize(
      principal,
      operation,
      assignmentRoles,
    );

    if (
      decision.code ===
      QuestionBankAuthorizationDecisionCode.AUTHENTICATION_REQUIRED
    ) {
      throw new UnauthorizedException(
        'Authentication is required to perform this Question Bank operation.',
      );
    }

    if (decision.code === QuestionBankAuthorizationDecisionCode.FORBIDDEN) {
      throw new ForbiddenException(
        'The authenticated principal is not authorized to perform this Question Bank operation.',
      );
    }

    return decision;
  }
}