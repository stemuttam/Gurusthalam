import {
  getAppConfig,
} from './app.config.js';

import {
  getDatabaseConfig,
} from './database.config.js';

import {
  getEnvironment,
} from './environment.js';

import {
  getRedisConfig,
} from './redis.config.js';

describe('Shared configuration', () => {
  const originalNodeEnv =
    process.env.NODE_ENV;

  const originalDatabaseUrl =
    process.env.DATABASE_URL;

  afterEach(() => {
    process.env.NODE_ENV =
      originalNodeEnv;

    process.env.DATABASE_URL =
      originalDatabaseUrl;
  });

  it('defaults to development environment', () => {
    delete process.env.NODE_ENV;

    expect(getEnvironment()).toBe(
      'development',
    );
  });

  it('creates application configuration', () => {
    process.env.NODE_ENV =
      'test';

    const config = getAppConfig();

    expect(config.name).toBe(
      'Gurusthalam',
    );

    expect(config.apiVersion).toBe('v1');
  });

  it('requires DATABASE_URL', () => {
    delete process.env.DATABASE_URL;

    expect(() =>
      getDatabaseConfig(),
    ).toThrow(
      'DATABASE_URL environment variable is required.',
    );
  });

  it('reads database configuration', () => {
    process.env.DATABASE_URL =
      'mongodb://localhost/gurusthalam';

    expect(
      getDatabaseConfig().uri,
    ).toBe(
      'mongodb://localhost/gurusthalam',
    );
  });

  it('provides default Redis configuration', () => {
    delete process.env.REDIS_URL;

    expect(
      getRedisConfig().url,
    ).toBe(
      'redis://localhost:6379',
    );
  });
});