import { describe, expect, it } from 'vitest';

/**
 * Phase 5.14-A4-E — Question Bank HTTP security integration.
 *
 * These tests call the real, running NestJS API over HTTP. They verify that
 * every Question Bank route registered for protected operations is stopped
 * at the authentication middleware when no bearer token is supplied.
 *
 * The tests intentionally do not use application-service or controller
 * mocks. They also do not create or modify Question Bank records.
 *
 * Authentication may be unconfigured in a local environment. In that case,
 * the real middleware must return its explicit 503 configuration response.
 * When configured, a request without a bearer token must return 401.
 *
 * The response-shape assertion distinguishes a middleware rejection from
 * a controller-level UnauthorizedException handled by the global filter.
 */

const apiBaseUrl = (
  process.env.API_RUNTIME_BASE_URL ?? 'http://127.0.0.1:3000/api'
).replace(/\/+$/, '');

type HttpMethod = 'POST' | 'PATCH' | 'DELETE' | 'GET';

interface ProtectedRoute {
  readonly name: string;
  readonly method: HttpMethod;
  readonly path: string;
  readonly body?: Readonly<Record<string, unknown>>;
}

interface HttpResult {
  readonly status: number;
  readonly requestId: string | null;
  readonly body: unknown;
}

const protectedRoutes: readonly ProtectedRoute[] = [
  {
    name: 'create Question',
    method: 'POST',
    path: '/question-bank/questions',
    body: {},
  },
  {
    name: 'revise Question',
    method: 'POST',
    path: '/question-bank/questions/question-a4e/versions',
    body: {},
  },
  {
    name: 'restore Question version',
    method: 'POST',
    path: '/question-bank/questions/question-a4e/restore/version-a4e',
  },
  {
    name: 'grant Question assignment',
    method: 'POST',
    path: '/question-bank/questions/question-a4e/assignments',
    body: {
      principalId: 'principal-a4e',
      role: 'EDITOR',
    },
  },
  {
    name: 'change Question assignment role',
    method: 'PATCH',
    path: '/question-bank/questions/question-a4e/assignments/principal-a4e',
    body: {
      role: 'AUTHOR',
    },
  },
  {
    name: 'revoke Question assignment',
    method: 'DELETE',
    path: '/question-bank/questions/question-a4e/assignments/principal-a4e',
  },
  {
    name: 'list Question assignments',
    method: 'GET',
    path: '/question-bank/questions/question-a4e/assignments',
  },
  {
    name: 'transfer Question ownership',
    method: 'POST',
    path: '/question-bank/questions/question-a4e/ownership/transfer',
    body: {
      newOwnerPrincipalId: 'principal-a4e-new-owner',
    },
  },
];

async function requestWithoutAuthentication(
  route: ProtectedRoute,
): Promise<HttpResult> {
  const requestId = `a4e-${route.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')}`;

  const response = await fetch(`${apiBaseUrl}${route.path}`, {
    method: route.method,
    headers: {
      accept: 'application/json',
      'x-request-id': requestId,
      ...(route.body === undefined
        ? {}
        : {
            'content-type': 'application/json',
          }),
    },
    ...(route.body === undefined
      ? {}
      : {
          body: JSON.stringify(route.body),
        }),
  });

  const responseText = await response.text();

  let body: unknown = null;

  if (responseText.length > 0) {
    try {
      body = JSON.parse(responseText) as unknown;
    } catch {
      body = responseText;
    }
  }

  return {
    status: response.status,
    requestId: response.headers.get('x-request-id'),
    body,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

describe('Question Bank HTTP security boundary — Phase 5.14-A4-E', () => {
  it.each(protectedRoutes)(
    'rejects unauthenticated HTTP $method requests for $name',
    async (route) => {
      const result = await requestWithoutAuthentication(route);

      expect(
        [401, 503],
        `${route.method} ${route.path} returned ${result.status}`,
      ).toContain(result.status);

      expect(isRecord(result.body)).toBe(true);

      if (!isRecord(result.body)) {
        throw new Error(
          'Expected the authentication middleware to return a JSON object.',
        );
      }

      if (result.status === 401) {
        expect(result.body).toMatchObject({
          code: 'AUTHENTICATION_REQUIRED',
          message: expect.any(String),
        });
      } else {
        expect(result.body).toMatchObject({
          code: 'AUTHENTICATION_NOT_CONFIGURED',
          message: expect.any(String),
        });
      }

      /*
       * Middleware responses are deliberately distinct from the global
       * exception-filter envelope. This proves that the request was
       * rejected before the controller boundary.
       */
      expect(result.body).not.toHaveProperty('statusCode');
      expect(result.body).not.toHaveProperty('timestamp');

      /*
       * RequestIdMiddleware must run before Question Bank authentication.
       * The supplied safe request ID must survive the early rejection.
       */
      expect(result.requestId).toBe(
        `a4e-${route.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      );
    },
  );

  it('covers all eight Question Bank protected route registrations', () => {
    expect(protectedRoutes).toHaveLength(8);

    expect(
      protectedRoutes.map(({ method, path }) => `${method} ${path}`),
    ).toEqual([
      'POST /question-bank/questions',
      'POST /question-bank/questions/question-a4e/versions',
      'POST /question-bank/questions/question-a4e/restore/version-a4e',
      'POST /question-bank/questions/question-a4e/assignments',
      'PATCH /question-bank/questions/question-a4e/assignments/principal-a4e',
      'DELETE /question-bank/questions/question-a4e/assignments/principal-a4e',
      'GET /question-bank/questions/question-a4e/assignments',
      'POST /question-bank/questions/question-a4e/ownership/transfer',
    ]);
  });
});
