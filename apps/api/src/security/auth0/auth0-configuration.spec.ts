import { describe, expect, it } from 'vitest';

import { loadAuth0Configuration } from './auth0-configuration.js';

describe('Auth0 resource-server configuration', () => {
  it('permits an entirely unconfigured non-production environment without bypassing protected routes', () => {
    expect(
      loadAuth0Configuration({ NODE_ENV: 'test' } as NodeJS.ProcessEnv),
    ).toBeNull();
  });

  it('requires Auth0 settings in production', () => {
    expect(() =>
      loadAuth0Configuration({ NODE_ENV: 'production' } as NodeJS.ProcessEnv),
    ).toThrow(/AUTH0_ISSUER_BASE_URL and AUTH0_AUDIENCE are required/);
  });

  it('rejects documented example placeholders in production', () => {
    expect(() =>
      loadAuth0Configuration({
        NODE_ENV: 'production',
        AUTH0_ISSUER_BASE_URL: 'https://YOUR_AUTH0_DOMAIN/',
        AUTH0_AUDIENCE: 'https://api.gurusthalam.example',
      } as NodeJS.ProcessEnv),
    ).toThrow(/placeholder values/);
  });

  it('rejects partial configuration', () => {
    expect(() =>
      loadAuth0Configuration({
        NODE_ENV: 'test',
        AUTH0_ISSUER_BASE_URL: 'https://tenant.example.auth0.com/',
      } as NodeJS.ProcessEnv),
    ).toThrow(/must both be configured/);
  });

  it('normalizes the issuer and sets the least-surprising default scope', () => {
    expect(
      loadAuth0Configuration({
        NODE_ENV: 'test',
        AUTH0_ISSUER_BASE_URL: 'https://tenant.example.auth0.com/',
        AUTH0_AUDIENCE: 'https://api.example.test',
      } as NodeJS.ProcessEnv),
    ).toEqual({
      issuerBaseUrl: 'https://tenant.example.auth0.com',
      issuer: 'https://tenant.example.auth0.com/',
      audience: 'https://api.example.test',
      learnerProgressScope: 'read:learning-progress',
    });
  });

  it('rejects issuer paths, query strings, and non-HTTPS issuers', () => {
    for (const issuer of [
      'http://tenant.example.auth0.com/',
      'https://tenant.example.auth0.com/path',
      'https://tenant.example.auth0.com/?mode=unsafe',
    ]) {
      expect(() =>
        loadAuth0Configuration({
          NODE_ENV: 'test',
          AUTH0_ISSUER_BASE_URL: issuer,
          AUTH0_AUDIENCE: 'https://api.example.test',
        } as NodeJS.ProcessEnv),
      ).toThrow(/must be an HTTPS issuer origin/);
    }
  });

  it('rejects malformed required scopes', () => {
    expect(() =>
      loadAuth0Configuration({
        NODE_ENV: 'test',
        AUTH0_ISSUER_BASE_URL: 'https://tenant.example.auth0.com/',
        AUTH0_AUDIENCE: 'https://api.example.test',
        AUTH0_LEARNING_PROGRESS_SCOPE: 'scope with spaces',
      } as NodeJS.ProcessEnv),
    ).toThrow(/AUTH0_LEARNING_PROGRESS_SCOPE is invalid/);
  });
});
