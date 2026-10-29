import { randomUUID } from 'node:crypto';

import { Redis } from 'ioredis';

import { getRedisConfig } from '@gurusthalam/config';

export const NOTIFICATION_IDEMPOTENCY_ACCEPTED_TTL_ENV =
  'NOTIFICATION_IDEMPOTENCY_ACCEPTED_TTL_SECONDS';

export const DEFAULT_NOTIFICATION_IDEMPOTENCY_ACCEPTED_TTL_SECONDS =
  7 * 24 * 60 * 60;

export const MIN_NOTIFICATION_IDEMPOTENCY_ACCEPTED_TTL_SECONDS = 24 * 60 * 60;

export const NOTIFICATION_IDEMPOTENCY_CLAIM_TTL_SECONDS = 5 * 60;

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

/**
 * Resolves the accepted-state retention policy.
 *
 * Redis is a bounded deduplication layer, not permanent delivery history.
 * PostgreSQL NotificationDelivery remains the durable delivery record.
 *
 * A configured TTL may extend retention, but may not shorten the existing
 * 24-hour window.
 */
export function resolveAcceptedTtlSeconds(
  rawValue: string | undefined = process.env[
    NOTIFICATION_IDEMPOTENCY_ACCEPTED_TTL_ENV
  ],
): number {
  if (rawValue === undefined) {
    return DEFAULT_NOTIFICATION_IDEMPOTENCY_ACCEPTED_TTL_SECONDS;
  }

  const normalizedValue = rawValue.trim();

  if (!/^\d+$/.test(normalizedValue)) {
    throw new Error(
      `${NOTIFICATION_IDEMPOTENCY_ACCEPTED_TTL_ENV} must be an integer of at least ${MIN_NOTIFICATION_IDEMPOTENCY_ACCEPTED_TTL_SECONDS} seconds.`,
    );
  }

  const seconds = Number(normalizedValue);

  if (
    !Number.isSafeInteger(seconds) ||
    seconds < MIN_NOTIFICATION_IDEMPOTENCY_ACCEPTED_TTL_SECONDS
  ) {
    throw new Error(
      `${NOTIFICATION_IDEMPOTENCY_ACCEPTED_TTL_ENV} must be an integer of at least ${MIN_NOTIFICATION_IDEMPOTENCY_ACCEPTED_TTL_SECONDS} seconds.`,
    );
  }

  return seconds;
}

export class NotificationIdempotencyService {
  private readonly redis: Redis;

  private readonly prefix = 'gurusthalam:notification:idempotency';

  /**
   * Retention for successfully accepted deliveries.
   *
   * This is a Redis deduplication window, not permanent delivery history.
   * The default is seven days, and configuration cannot reduce it below
   * the existing 24-hour retention contract.
   */
  private readonly acceptedTtlSeconds: number;

  /**
   * Bounds abandoned claims after a worker exits unexpectedly.
   *
   * This is not a renewable lease. Provider submission uncertainty is
   * governed by the durable NotificationDelivery lifecycle.
   */
  private readonly claimTtlSeconds = NOTIFICATION_IDEMPOTENCY_CLAIM_TTL_SECONDS;

  constructor() {
    this.acceptedTtlSeconds = resolveAcceptedTtlSeconds();

    const config = getRedisConfig();

    this.redis = new Redis(config.url);
  }

  /**
   * Atomically claims a delivery key.
   *
   * Only the worker that successfully creates the claim may finalise it.
   * A competing worker must distinguish accepted delivery from an attempt
   * that is still in progress.
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
     * Retry only when the key is absent. An unexpected non-empty value
     * is not proof that the key is available, so fail closed rather than
     * attempting to claim it.
     */
    if (existingValue !== null) {
      return {
        status: 'in_progress',
        deliveryKey,
      };
    }

    /*
     * The key disappeared between SET NX and GET. Retry once atomically.
     * SET NX determines ownership; the preceding GET does not grant it.
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

    /*
     * Another worker may have claimed or accepted the delivery after
     * the retry lost. Only an explicitly accepted value proves that
     * Redis currently records acceptance.
     */
    const latestValue = await this.redis.get(key);

    if (latestValue === 'accepted') {
      return {
        status: 'accepted',
        deliveryKey,
      };
    }

    /*
     * A competing claim, missing key, or unexpected value is not
     * evidence of acceptance or ownership. Fail closed.
     */
    return {
      status: 'in_progress',
      deliveryKey,
    };
  }

  /**
   * Records acceptance only when the caller still owns the claim.
   *
   * Redis executes the ownership check and state transition atomically.
   * The accepted-state TTL is applied at this transition, not at claim time.
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
