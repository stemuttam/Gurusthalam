
import type { NextFunction, Request, Response } from 'express';

import { describe, expect, it, vi } from 'vitest';

import type { Auth0Configuration } from './auth0-configuration.js';

import {
  Auth0QuestionBankAssignmentScopeMiddleware,
} from './auth0-question-bank-assignment-scope.middleware.js';

const configuration: Auth0Configuration = {
  issuerBaseUrl: 'https://tenant.example.auth0.com',
  issuer: 'https://tenant.example.auth0.com/',
  audience: 'https://api.example.test',
  learnerProgressScope: 'read:learning-progress',
  questionBankWriteScope: 'write:question-bank',
  questionBankAssignmentManagementScope: 'manage:question-bank-access',
};

interface ResponseFixture {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
}

function createResponse(): ResponseFixture {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  } as unknown as ResponseFixture;

  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);

  return response;
}

function createRequest(scope: unknown): Request {
  return {
    auth: {
      payload: {
        scope,
      },
    },
  } as unknown as Request;
}

function createMiddleware(
  authConfiguration: Auth0Configuration | null = configuration,
): Auth0QuestionBankAssignmentScopeMiddleware {
  return new Auth0QuestionBankAssignmentScopeMiddleware(
    authConfiguration,
  );
}

describe('Auth0QuestionBankAssignmentScopeMiddleware', () => {
  it('allows a verified token containing both required scopes', () => {
    const middleware = createMiddleware();
    const request = createRequest(
      'write:question-bank manage:question-bank-access',
    );
    const response = createResponse();
    const next = vi.fn() as unknown as NextFunction;

    middleware.use(request, response as unknown as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
  });

  it('allows both required scopes when additional scopes are present', () => {
    const middleware = createMiddleware();
    const request = createRequest(
      'read:learning-progress write:question-bank manage:question-bank-access',
    );
    const response = createResponse();
    const next = vi.fn() as unknown as NextFunction;

    middleware.use(request, response as unknown as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  it('rejects a token containing only the Question Bank write scope', () => {
    const middleware = createMiddleware();
    const request = createRequest('write:question-bank');
    const response = createResponse();
    const next = vi.fn() as unknown as NextFunction;

    middleware.use(request, response as unknown as Response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({
      code: 'INSUFFICIENT_SCOPE',
      message:
        'The access token lacks one or more required Question Bank assignment-management scopes.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a token containing only the assignment-management scope', () => {
    const middleware = createMiddleware();
    const request = createRequest('manage:question-bank-access');
    const response = createResponse();
    const next = vi.fn() as unknown as NextFunction;

    middleware.use(request, response as unknown as Response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({
      code: 'INSUFFICIENT_SCOPE',
      message:
        'The access token lacks one or more required Question Bank assignment-management scopes.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a token missing both required scopes', () => {
    const middleware = createMiddleware();
    const request = createRequest('read:learning-progress');
    const response = createResponse();
    const next = vi.fn() as unknown as NextFunction;

    middleware.use(request, response as unknown as Response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a scope with only a partial or prefixed assignment-scope match', () => {
    const middleware = createMiddleware();
    const request = createRequest(
      'write:question-bank manage:question-bank-access-extra',
    );
    const response = createResponse();
    const next = vi.fn() as unknown as NextFunction;

    middleware.use(request, response as unknown as Response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    null,
    '',
    ['write:question-bank', 'manage:question-bank-access'],
    123,
  ])('rejects an invalid scope claim: %s', (scope) => {
    const middleware = createMiddleware();
    const request = createRequest(scope);
    const response = createResponse();
    const next = vi.fn() as unknown as NextFunction;

    middleware.use(request, response as unknown as Response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({
      code: 'INSUFFICIENT_SCOPE',
      message:
        'The access token lacks one or more required Question Bank assignment-management scopes.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects requests without verified Auth0 context', () => {
    const middleware = createMiddleware();
    const request = {} as Request;
    const response = createResponse();
    const next = vi.fn() as unknown as NextFunction;

    middleware.use(request, response as unknown as Response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      code: 'AUTHENTICATION_REQUIRED',
      message: 'A verified Auth0 access token is required.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('fails closed when Auth0 is not configured', () => {
    const middleware = createMiddleware(null);
    const request = createRequest(
      'write:question-bank manage:question-bank-access',
    );
    const response = createResponse();
    const next = vi.fn() as unknown as NextFunction;

    middleware.use(request, response as unknown as Response, next);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith({
      code: 'AUTHENTICATION_NOT_CONFIGURED',
      message: 'The authentication provider is not configured.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('does not accept a scope value from query or body data', () => {
    const middleware = createMiddleware();
    const request = {
      query: {
        scope: 'write:question-bank manage:question-bank-access',
      },
      body: {
        scope: 'write:question-bank manage:question-bank-access',
      },
    } as unknown as Request;
    const response = createResponse();
    const next = vi.fn() as unknown as NextFunction;

    middleware.use(request, response as unknown as Response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('uses the configured assignment-management scope and still requires the write scope', () => {
    const customConfiguration: Auth0Configuration = {
      ...configuration,
      questionBankAssignmentManagementScope:
        'manage:custom-question-access',
    };

    const middleware = createMiddleware(customConfiguration);

    const validRequest = createRequest(
      'write:question-bank manage:custom-question-access',
    );
    const validResponse = createResponse();
    const validNext = vi.fn() as unknown as NextFunction;

    middleware.use(
      validRequest,
      validResponse as unknown as Response,
      validNext,
    );

    expect(validNext).toHaveBeenCalledTimes(1);

    const invalidRequest = createRequest(
      'manage:custom-question-access',
    );
    const invalidResponse = createResponse();
    const invalidNext = vi.fn() as unknown as NextFunction;

    middleware.use(
      invalidRequest,
      invalidResponse as unknown as Response,
      invalidNext,
    );

    expect(invalidResponse.status).toHaveBeenCalledWith(403);
    expect(invalidNext).not.toHaveBeenCalled();
  });
});
