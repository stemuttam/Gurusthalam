import { randomUUID } from 'node:crypto';

import { Redis } from 'ioredis';

import { getRedisConfig } from '@gurusthalam/config';

export type NotificationIdempotencyClaim =
  | {
      readonly status: 'claimed';
      readonly deliveryKey: string;
      readonly claimToken: string;
    }
  | {
      readonly status: 'accepted';
      readonly deliveryKey: string;
    }
  | {
      readonly status: 'in_progress';
      readonly deliveryKey: string;
    };

export class NotificationIdempotencyService {
  private readonly redis: Redis;

  private readonly prefix = 'gurusthalam:notification:idempotency';

  /**
   * Retention for a successfully accepted delivery.
   *
   * This is a Redis deduplication window, not permanent delivery history.
   */
  private readonly acceptedTtlSeconds = 60 * 60 * 24;

  /**
   * Bounds abandoned claims after a worker exits unexpectedly.
   *
   * This is not a substitute for a renewable lease when a real provider
   * call can take longer than this interval.
   */
  private readonly claimTtlSeconds = 60 * 5;

  constructor() {
    const config = getRedisConfig();

    this.redis = new Redis(config.url);
  }

  /**
   * Atomically claims a delivery key.
   *
   * Only the worker that successfully creates the claim may finalise it.
   * A competing worker must distinguish an accepted delivery from an
   * attempt that is still in progress.
   */
  async claim(deliveryKey: string): Promise<NotificationIdempotencyClaim> {
    this.validateDeliveryKey(deliveryKey);

    const key = this.getKey(deliveryKey);
    const claimToken = randomUUID();

    const result = await this.redis.set(
      key,
      `processing:${claimToken}`,
      'EX',
      this.claimTtlSeconds,
      'NX',
    );

    if (result === 'OK') {
      return {
        status: 'claimed',
        deliveryKey,
        claimToken,
      };
    }

    const existingValue = await this.redis.get(key);

    /*
     * The value may have changed between SET NX and GET because another
     * worker can finalise or release a claim concurrently. Treat the
     * observed state conservatively.
     */
    if (existingValue === 'accepted') {
      return {
        status: 'accepted',
        deliveryKey,
      };
    }

    if (existingValue?.startsWith('processing:')) {
      return {
        status: 'in_progress',
        deliveryKey,
      };
    }

    /*
     * The key may have expired or been released between commands.
     * Do not guess that the delivery was accepted. The caller may retry.
     */
    const retryResult = await this.redis.set(
      key,
      `processing:${claimToken}`,
      'EX',
      this.claimTtlSeconds,
      'NX',
    );

    if (retryResult === 'OK') {
      return {
        status: 'claimed',
        deliveryKey,
        claimToken,
      };
    }

    const latestValue = await this.redis.get(key);

    if (latestValue === 'accepted') {
      return {
        status: 'accepted',
        deliveryKey,
      };
    }

    return {
      status: 'in_progress',
      deliveryKey,
    };
  }

  /**
   * Records acceptance only when the caller still owns the claim.
   *
   * Redis executes the ownership check and state transition atomically.
   */
  async markAccepted(
    deliveryKey: string,
    claimToken: string,
  ): Promise<boolean> {
    this.validateDeliveryKey(deliveryKey);
    this.validateClaimToken(claimToken);

    const script = `
      local current = redis.call('GET', KEYS[1])

      if current ~= ARGV[1] then
        return 0
      end

      redis.call('SET', KEYS[1], 'accepted', 'EX', ARGV[2])
      return 1
    `;

    const result = await this.redis.eval(
      script,
      1,
      this.getKey(deliveryKey),
      `processing:${claimToken}`,
      String(this.acceptedTtlSeconds),
    );

    return result === 1;
  }

  /**
   * Releases a claim only when the caller still owns it.
   *
   * Never call this after the provider may have accepted the message:
   * doing so could permit a duplicate external delivery.
   */
  async releaseClaim(
    deliveryKey: string,
    claimToken: string,
  ): Promise<boolean> {
    this.validateDeliveryKey(deliveryKey);
    this.validateClaimToken(claimToken);

    const script = `
      local current = redis.call('GET', KEYS[1])

      if current ~= ARGV[1] then
        return 0
      end

      return redis.call('DEL', KEYS[1])
    `;

    const result = await this.redis.eval(
      script,
      1,
      this.getKey(deliveryKey),
      `processing:${claimToken}`,
    );

    return result === 1;
  }

  /**
   * Read-only compatibility helper.
   *
   * New delivery code should use claim() because a separate existence
   * check cannot establish ownership.
   */
  async isAccepted(deliveryKey: string): Promise<boolean> {
    this.validateDeliveryKey(deliveryKey);

    return (await this.redis.get(this.getKey(deliveryKey))) === 'accepted';
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }

  private getKey(deliveryKey: string): string {
    return `${this.prefix}:${deliveryKey}`;
  }

  private validateDeliveryKey(deliveryKey: string): void {
    if (deliveryKey.trim().length === 0) {
      throw new Error('Notification delivery key must not be empty.');
    }
  }

  private validateClaimToken(claimToken: string): void {
    if (claimToken.trim().length === 0) {
      throw new Error('Notification claim token must not be empty.');
    }
  }
}
