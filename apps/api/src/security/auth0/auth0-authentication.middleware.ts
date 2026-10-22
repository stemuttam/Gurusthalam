import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';

import type { NextFunction, Request, Response } from 'express';

import {
  InvalidTokenError,
  UnauthorizedError,
  auth,
} from 'express-oauth2-jwt-bearer';

import {
  AUTH0_CONFIGURATION,
  type Auth0Configuration,
} from './auth0-configuration.js';

import { Auth0IdentityResolver } from './auth0-identity-resolver.js';

interface RequestWithAuthContext {
  user?: unknown;
  auth?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function extractVerifiedPayload(
  request: Request,
): Record<string, unknown> | null {
  const authContext = (request as unknown as RequestWithAuthContext).auth;
  if (!isRecord(authContext) || !isRecord(authContext.payload)) {
    return null;
  }

  return authContext.payload;
}

export function hasRequiredScope(
  scopeClaim: unknown,
  requiredScope: string,
): boolean {
  if (typeof scopeClaim !== 'string') {
    return false;
  }

  return scopeClaim.split(/\s+/).filter(Boolean).includes(requiredScope);
}

/** Learner-facing routes do not accept machine-to-machine client identities. */
export function isEndUserAuth0Identity(
  subject: unknown,
  grantType: unknown,
): subject is string {
  return (
    typeof subject === 'string' &&
    subject.length > 0 &&
    subject.trim() === subject &&
    grantType !== 'client-credentials' &&
    !subject.endsWith('@clients')
  );
}

/**
 * Auth0 resource-server middleware for protected learner-facing query routes.
 * `auth()` verifies JWT signature/JWKS, expiry, issuer and audience; this class
 * then applies scope checks and resolves only Gurusthalam-owned identities.
 */
@Injectable()
export class Auth0AuthenticationMiddleware implements NestMiddleware {
  private readonly validateAccessToken: ReturnType<typeof auth> | null;

  constructor(
    @Inject(AUTH0_CONFIGURATION)
    private readonly configuration: Auth0Configuration | null,
    private readonly identityResolver: Auth0IdentityResolver,
  ) {
    this.validateAccessToken = configuration
      ? auth({
          issuerBaseURL: configuration.issuerBaseUrl,
          audience: configuration.audience,
          tokenSigningAlg: 'RS256',
        })
      : null;
  }

  use(request: Request, response: Response, next: NextFunction): void {
    const configuration = this.configuration;
    const validateAccessToken = this.validateAccessToken;

    if (configuration === null || validateAccessToken === null) {
      response.status(503).json({
        code: 'AUTHENTICATION_NOT_CONFIGURED',
        message: 'The authentication provider is not configured.',
      });
      return;
    }

    validateAccessToken(request, response, (error) => {
      if (error !== undefined && error !== null) {
        if (
          error instanceof InvalidTokenError ||
          error instanceof UnauthorizedError
        ) {
          response.status(401).json({
            code: 'AUTHENTICATION_REQUIRED',
            message: 'A valid Auth0 access token is required.',
          });
          return;
        }

        next(error);
        return;
      }

      const payload = extractVerifiedPayload(request);
      const subject = payload?.sub;
      const organizationId = payload?.org_id;

      if (
        !isEndUserAuth0Identity(subject, payload?.gty) ||
        (organizationId !== undefined &&
          (typeof organizationId !== 'string' ||
            organizationId.length === 0 ||
            organizationId.trim() !== organizationId))
      ) {
        response.status(401).json({
          code: 'INVALID_AUTHENTICATED_IDENTITY',
          message: 'The access token does not contain a valid identity.',
        });
        return;
      }

      if (
        !hasRequiredScope(payload?.scope, configuration.learnerProgressScope)
      ) {
        response.status(403).json({
          code: 'INSUFFICIENT_SCOPE',
          message:
            'The access token lacks the required learning-progress scope.',
        });
        return;
      }

      const verifiedIdentity = {
        issuer: configuration.issuer,
        subject,
        ...(organizationId === undefined ? {} : { organizationId }),
      };

      void this.identityResolver
        .resolve(verifiedIdentity)
        .then((principal) => {
          if (principal === null) {
            response.status(403).json({
              code: 'IDENTITY_NOT_PROVISIONED',
              message:
                'This authenticated identity has no active Gurusthalam learner membership.',
            });
            return;
          }

          (request as unknown as RequestWithAuthContext).user = principal;
          next();
        })
        .catch((resolverError: unknown) => {
          next(resolverError);
        });
    });
  }
}
