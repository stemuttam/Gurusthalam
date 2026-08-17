import {
  Injectable,
} from '@nestjs/common';

import {
  Redis,
} from 'ioredis';

import {
  getRedisConfig,
} from '@gurusthalam/config';

@Injectable()
export class NotificationIdempotencyService {
  private readonly redis: Redis;

  private readonly prefix =
    'gurusthalam:notification:idempotency';

  private readonly ttlSeconds =
    60 * 60 * 24;

  constructor() {
    const config =
      getRedisConfig();

    this.redis =
      new Redis(config.url);
  }

  async isAccepted(
    deliveryKey: string,
  ): Promise<boolean> {
    const key =
      this.getKey(
        deliveryKey,
      );

    const exists =
      await this.redis.exists(
        key,
      );

    return exists === 1;
  }

  async markAccepted(
    deliveryKey: string,
  ): Promise<boolean> {
    const key =
      this.getKey(
        deliveryKey,
      );

    /*
     * SET NX means:
     *   create only if the key does not already exist.
     *
     * This is the important cross-process idempotency primitive.
     */
    const result =
      await this.redis.set(
        key,
        'accepted',
        'EX',
        this.ttlSeconds,
        'NX',
      );

    return result === 'OK';
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }

  private getKey(
    deliveryKey: string,
  ): string {
    return `${this.prefix}:${deliveryKey}`;
  }
}