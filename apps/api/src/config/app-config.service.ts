import { Injectable } from '@nestjs/common';

import {
  getAppConfig,
  getRedisConfig,
  type AppConfig,
  type RedisConfig,
} from '@gurusthalam/config';

import {
  positiveIntegerSchema,
  safeValidate,
  urlSchema,
} from '@gurusthalam/validation';

@Injectable()
export class AppConfigService {
  private readonly config: AppConfig;
  private readonly redis: RedisConfig;

  constructor() {
    const appConfig = getAppConfig();

    const portResult = safeValidate(
      positiveIntegerSchema,
      appConfig.port,
    );

    if (!portResult.success) {
      throw new Error(
        `Invalid PORT value: ${String(
          process.env.PORT ?? '',
        )}`,
      );
    }

    const redisConfig = getRedisConfig();

    const redisResult = safeValidate(
      urlSchema,
      redisConfig.url,
    );

    if (!redisResult.success) {
      throw new Error(
        `Invalid REDIS_URL value: ${redisConfig.url}`,
      );
    }

    this.config = appConfig;
    this.redis = redisConfig;
  }

  get name(): string {
    return this.config.name;
  }

  get description(): string {
    return this.config.description;
  }

  get environment(): string {
    return this.config.environment;
  }

  get apiPrefix(): string {
    return this.config.apiPrefix;
  }

  get apiVersion(): string {
    return this.config.apiVersion;
  }

  get port(): number {
    return this.config.port;
  }

  get redisUrl(): string {
    return this.redis.url;
  }
}