import {
  ENVIRONMENT,
  type Environment,
} from '@gurusthalam/constants';

export function getEnvironment(): Environment {
  const value = process.env.NODE_ENV ?? ENVIRONMENT.DEVELOPMENT;

  if (
    Object.values(ENVIRONMENT).includes(
      value as Environment,
    )
  ) {
    return value as Environment;
  }

  throw new Error(
    `Invalid NODE_ENV: ${value}`,
  );
}