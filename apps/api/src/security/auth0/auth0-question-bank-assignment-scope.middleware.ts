
import {
  Inject,
  Injectable,
  type NestMiddleware,
} from '@nestjs/common';

import type {
  NextFunction,
  Request,
  Response,
} from 'express';

import {
  AUTH0_CONFIGURATION,
  type Auth0Configuration,
} from './auth0-configuration.js';

import { hasRequiredScope } from './auth0-authentication.middleware.js';

interface RequestWithAuthContext {
  readonly auth?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Enforces both required scopes for Question Bank assignment-management APIs.
 *
 * Required scopes:
 * - write:question-bank (configurable)
 * - manage:question-bank-access (configurable)
 *
 * IMPORTANT:
 * This middleware must execute after Auth0QuestionBankAuthenticationMiddleware.
 * The preceding middleware validates the JWT and attaches its verified Auth0
 * context to request.auth before this middleware reads the scope claim.
 *
 * Both scopes are required for every assignment-management API caller,
 * including Question OWNERs, tenant administrators and Question Bank admins.
 *
 * This middleware does not replace repository authorization. The persistence
 * layer remains authoritative for Question-level manager permissions.
 */
@Injectable()
export class Auth0QuestionBankAssignmentScopeMiddleware
  implements NestMiddleware
{
  constructor(
    @Inject(AUTH0_CONFIGURATION)
    private readonly configuration: Auth0Configuration | null,
  ) {}

  use(
    request: Request,
    response: Response,
    next: NextFunction,
  ): void {
    const configuration = this.configuration;

    if (configuration === null) {
      response.status(503).json({
        code: 'AUTHENTICATION_NOT_CONFIGURED',
        message: 'The authentication provider is not configured.',
      });
      return;
    }

    const authContext = (request as unknown as RequestWithAuthContext).auth;

    if (!isRecord(authContext) || !isRecord(authContext.payload)) {
      response.status(401).json({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'A verified Auth0 access token is required.',
      });
      return;
    }

    const scopeClaim = authContext.payload.scope;

    const hasQuestionBankWriteScope = hasRequiredScope(
      scopeClaim,
      configuration.questionBankWriteScope,
    );

    const hasAssignmentManagementScope = hasRequiredScope(
      scopeClaim,
      configuration.questionBankAssignmentManagementScope,
    );

    if (
      !hasQuestionBankWriteScope ||
      !hasAssignmentManagementScope
    ) {
      response.status(403).json({
        code: 'INSUFFICIENT_SCOPE',
        message:
          'The access token lacks one or more required Question Bank assignment-management scopes.',
      });
      return;
    }

    next();
  }
}
