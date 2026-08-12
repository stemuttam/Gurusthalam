export const ENVIRONMENT = {
  DEVELOPMENT: 'development',
  TEST: 'test',
  STAGING: 'staging',
  PRODUCTION: 'production',
} as const;

export type Environment =
  (typeof ENVIRONMENT)[keyof typeof ENVIRONMENT];