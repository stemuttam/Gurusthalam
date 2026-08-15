import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { Redis } from 'ioredis';

import { getRedisConfig } from '@gurusthalam/config';

@Injectable()
export class RedisService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly client: Redis;

  constructor() {
    const config = getRedisConfig();

    this.client = new Redis(config.url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  getClient(): Redis {
    return this.client;
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async get(
    key: string,
  ): Promise<string | null> {
    return this.client.get(key);
  }

  async set(
    key: string,
    value: string,
    ttlSeconds?: number,
  ): Promise<'OK'> {
    if (ttlSeconds === undefined) {
      return this.client.set(
        key,
        value,
      );
    }

    return this.client.set(
      key,
      value,
      'EX',
      ttlSeconds,
    );
  }

  async delete(
    key: string,
  ): Promise<number> {
    return this.client.del(key);
  }
}