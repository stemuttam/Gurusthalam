import { beforeEach, describe, expect, it, vi } from 'vitest';

const redisMocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  eval: vi.fn(),
  quit: vi.fn(),
}));

vi.mock('ioredis', () => ({
  Redis: vi.fn(function RedisMock() {
    return redisMocks;
  }),
}));

vi.mock('@gurusthalam/config', () => ({
  getRedisConfig: vi.fn(() => ({ url: 'redis://127.0.0.1:6379' })),
}));

import {
  NOTIFICATION_IDEMPOTENCY_CLAIM_TTL_SECONDS,
  NotificationIdempotencyService,
} from './notification-idempotency.service.js';

describe('NotificationIdempotencyService claim-state races', () => {
  let service: NotificationIdempotencyService;

  const key = 'gurusthalam:notification:idempotency:delivery-race';

  beforeEach(() => {
    vi.clearAllMocks();
    redisMocks.get.mockResolvedValue(null);
    redisMocks.set.mockResolvedValue(null);
    redisMocks.eval.mockResolvedValue(0);
    redisMocks.quit.mockResolvedValue('OK');
    service = new NotificationIdempotencyService();
  });

  it('returns accepted when a competing worker finalizes before the first GET', async () => {
    redisMocks.set.mockResolvedValueOnce(null);
    redisMocks.get.mockResolvedValueOnce('accepted');

    await expect(service.claim('delivery-race')).resolves.toEqual({
      status: 'accepted',
      deliveryKey: 'delivery-race',
    });

    expect(redisMocks.set).toHaveBeenCalledTimes(1);
    expect(redisMocks.get).toHaveBeenCalledTimes(1);
  });

  it('returns in_progress when another worker still owns the key at the first GET', async () => {
    redisMocks.set.mockResolvedValueOnce(null);
    redisMocks.get.mockResolvedValueOnce('processing:other-worker');

    await expect(service.claim('delivery-race')).resolves.toEqual({
      status: 'in_progress',
      deliveryKey: 'delivery-race',
    });

    expect(redisMocks.set).toHaveBeenCalledTimes(1);
    expect(redisMocks.get).toHaveBeenCalledTimes(1);
  });

  it('claims the key when it disappears before the retry SET NX', async () => {
    redisMocks.set.mockResolvedValueOnce(null).mockResolvedValueOnce('OK');
    redisMocks.get.mockResolvedValueOnce(null);

    const result = await service.claim('delivery-race');

    expect(result.status).toBe('claimed');
    if (result.status !== 'claimed') {
      throw new Error('Expected this worker to acquire the claim');
    }

    expect(result.deliveryKey).toBe('delivery-race');
    expect(result.claimToken).toEqual(expect.any(String));
    expect(redisMocks.set).toHaveBeenNthCalledWith(
      2,
      key,
      `processing:${result.claimToken}`,
      'EX',
      NOTIFICATION_IDEMPOTENCY_CLAIM_TTL_SECONDS,
      'NX',
    );
    expect(redisMocks.get).toHaveBeenCalledTimes(1);
  });

  it('returns accepted when the retry loses and the final GET observes acceptance', async () => {
    redisMocks.set.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    redisMocks.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('accepted');

    await expect(service.claim('delivery-race')).resolves.toEqual({
      status: 'accepted',
      deliveryKey: 'delivery-race',
    });

    expect(redisMocks.set).toHaveBeenCalledTimes(2);
    expect(redisMocks.get).toHaveBeenCalledTimes(2);
  });

  it('returns in_progress when the retry loses and the final GET observes a competing claim', async () => {
    redisMocks.set.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    redisMocks.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('processing:other-worker');

    await expect(service.claim('delivery-race')).resolves.toEqual({
      status: 'in_progress',
      deliveryKey: 'delivery-race',
    });

    expect(redisMocks.set).toHaveBeenCalledTimes(2);
    expect(redisMocks.get).toHaveBeenCalledTimes(2);
  });

  it.each([null, 'unexpected-state'])(
    'fails closed as in_progress when the final GET observes %j after a lost retry',
    async (latestValue) => {
      redisMocks.set.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      redisMocks.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(latestValue);

      await expect(service.claim('delivery-race')).resolves.toEqual({
        status: 'in_progress',
        deliveryKey: 'delivery-race',
      });

      expect(redisMocks.set).toHaveBeenCalledTimes(2);
      expect(redisMocks.get).toHaveBeenCalledTimes(2);
    },
  );

  it('does not retry a claim when the first read sees an unexpected non-empty value', async () => {
    redisMocks.set.mockResolvedValueOnce(null);
    redisMocks.get.mockResolvedValueOnce('unexpected-state');

    await expect(service.claim('delivery-race')).resolves.toEqual({
      status: 'in_progress',
      deliveryKey: 'delivery-race',
    });

    expect(redisMocks.set).toHaveBeenCalledTimes(1);
    expect(redisMocks.get).toHaveBeenCalledTimes(1);
  });
});
