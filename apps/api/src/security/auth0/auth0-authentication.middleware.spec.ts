import {
  Controller,
  Get,
  Module,
  RequestMethod,
  Req,
  type INestApplication,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';

import type { Request } from 'express';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  AUTH0_CONFIGURATION,
  type Auth0Configuration,
} from './auth0-configuration.js';
import {
  Auth0AuthenticationMiddleware,
  hasRequiredScope,
  isEndUserAuth0Identity,
} from './auth0-authentication.middleware.js';
import { Auth0IdentityResolver } from './auth0-identity-resolver.js';

@Controller('auth0-test')
class Auth0TestController {
  @Get('private')
  getPrivate(@Req() request: Request): unknown {
    return {
      authenticated: Boolean((request as Request & { user?: unknown }).user),
    };
  }
}

const configuration: Auth0Configuration = {
  issuerBaseUrl: 'https://tenant.example.auth0.com',
  issuer: 'https://tenant.example.auth0.com/',
  audience: 'https://api.example.test',
  learnerProgressScope: 'read:learning-progress',
};

@Module({
  controllers: [Auth0TestController],
  providers: [
    { provide: AUTH0_CONFIGURATION, useValue: configuration },
    {
      provide: Auth0IdentityResolver,
      useValue: { resolve: vi.fn() },
    },
    Auth0AuthenticationMiddleware,
  ],
})
class Auth0TestModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(Auth0AuthenticationMiddleware).forRoutes({
      path: 'auth0-test/private',
      method: RequestMethod.GET,
    });
  }
}

describe('Auth0AuthenticationMiddleware', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [Auth0TestModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0, '127.0.0.1');

    const address = app.getHttpServer().address();
    if (address === null || typeof address === 'string') {
      throw new Error(
        'Expected the Auth0 middleware test server to expose a TCP address.',
      );
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('rejects missing credentials before calling identity resolution', async () => {
    const response = await fetch(`${baseUrl}/auth0-test/private`);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
    });
  });

  it('rejects malformed bearer tokens', async () => {
    const response = await fetch(`${baseUrl}/auth0-test/private`, {
      headers: { authorization: 'Bearer not-a-valid-jwt' },
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
    });
  });

  it('rejects machine-to-machine subjects for learner-facing routes', () => {
    expect(isEndUserAuth0Identity('auth0|learner-001', undefined)).toBe(true);
    expect(
      isEndUserAuth0Identity('client-id@clients', 'client-credentials'),
    ).toBe(false);
    expect(isEndUserAuth0Identity('client-id@clients', undefined)).toBe(false);
    expect(isEndUserAuth0Identity('', undefined)).toBe(false);
  });

  it('requires the exact configured scope in the verified scope claim', () => {
    expect(
      hasRequiredScope(
        'read:learning-progress write:lesson-progress',
        'read:learning-progress',
      ),
    ).toBe(true);
    expect(
      hasRequiredScope('write:lesson-progress', 'read:learning-progress'),
    ).toBe(false);
    expect(hasRequiredScope(undefined, 'read:learning-progress')).toBe(false);
    expect(
      hasRequiredScope(['read:learning-progress'], 'read:learning-progress'),
    ).toBe(false);
  });
});
