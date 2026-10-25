import { randomUUID } from 'node:crypto';

import { getRedisConfig } from '@gurusthalam/config';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { NotificationIdempotencyService } from './notification-idempotency.service.js';

describe('NotificationIdempotencyService - real Redis ownership integration', () => {
  let service: NotificationIdempotencyService;
  let redis: Redis;

  const deliveryKey = `p1-6-expiry-${randomUUID()}`;
  const secondaryDeliveryKey = `${deliveryKey}-secondary`;
  const redisKey = `gurusthalam:notification:idempotency:${deliveryKey}`;
  const secondaryRedisKey = `gurusthalam:notification:idempotency:${secondaryDeliveryKey}`;

  beforeAll(async () => {
    service = new NotificationIdempotencyService();
    redis = new Redis(getRedisConfig().url);
    await redis.ping();
  });

  afterAll(async () => {
    if (redis) {
      await redis.del(redisKey, secondaryRedisKey);
      await redis.quit();
    }
    if (service) await service.close();
  });

  it('rejects an expired owner after a new owner acquires the same delivery key', async () => {
    const first = await service.claim(deliveryKey);
    expect(first.status).toBe('claimed');
    if (first.status !== 'claimed') throw new Error('Expected first claim to succeed.');

    // Expire the real Redis claim immediately rather than waiting for the
    // production five-minute claim TTL.
    await redis.pexpire(redisKey, 1);
    await new Promise<void>((resolve) => setTimeout(resolve, 25));

    const second = await service.claim(deliveryKey);
    expect(second.status).toBe('claimed');
    if (second.status !== 'claimed') throw new Error('Expected second claim to succeed.');
    expect(second.claimToken).not.toBe(first.claimToken);

    expect(await service.markAccepted(deliveryKey, first.claimToken)).toBe(false);
    expect(await service.releaseClaim(deliveryKey, first.claimToken)).toBe(false);

    expect(await service.markAccepted(deliveryKey, second.claimToken)).toBe(true);
    expect(await service.isAccepted(deliveryKey)).toBe(true);

    const acceptedTtl = await redis.ttl(redisKey);
    expect(acceptedTtl).toBeGreaterThan(0);
  });

  it('allows a new claim after the Redis claim key is deleted', async () => {
    const first = await service.claim(secondaryDeliveryKey);
    expect(first.status).toBe('claimed');
    if (first.status !== 'claimed') throw new Error('Expected initial claim to succeed.');

    await redis.del(secondaryRedisKey);

    const reclaimed = await service.claim(secondaryDeliveryKey);
    expect(reclaimed.status).toBe('claimed');
    if (reclaimed.status !== 'claimed') throw new Error('Expected a new claim after key expiry.');
    expect(reclaimed.claimToken).not.toBe(first.claimToken);

    await service.releaseClaim(secondaryDeliveryKey, reclaimed.claimToken);
  });
});
