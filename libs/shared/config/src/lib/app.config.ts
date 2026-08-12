import {
  API_PREFIX,
  API_VERSION,
  APP_DESCRIPTION,
  APP_NAME,
} from '@gurusthalam/constants';

import { getEnvironment } from './environment.js';

export interface AppConfig {
  readonly name: string;
  readonly description: string;
  readonly environment: ReturnType<typeof getEnvironment>;
  readonly apiPrefix: string;
  readonly apiVersion: string;
  readonly port: number;
}

export function getAppConfig(): AppConfig {
  return {
    name: APP_NAME,
    description: APP_DESCRIPTION,
    environment: getEnvironment(),
    apiPrefix: API_PREFIX,
    apiVersion: API_VERSION,
    port: Number(process.env.PORT ?? 3000),
  };
}