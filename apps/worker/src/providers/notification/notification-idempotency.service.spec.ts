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

import { NotificationIdempotencyService } from './notification-idempotency.service.js';

describe('NotificationIdempotencyService', () => {
  let service: NotificationIdempotencyService;

  beforeEach(() => {
    vi.clearAllMocks();
    redisMocks.get.mockResolvedValue(null);
    redisMocks.set.mockResolvedValue(null);
    redisMocks.eval.mockResolvedValue(0);
    redisMocks.quit.mockResolvedValue('OK');
    service = new NotificationIdempotencyService();
  });

  it('claims an unowned delivery key atomically with SET NX and returns its token', async () => {
    redisMocks.set.mockResolvedValueOnce('OK');

    const result = await service.claim('delivery-1');

    expect(result.status).toBe('claimed');
    if (result.status !== 'claimed') {
      throw new Error('Expected a claimed result');
    }
    expect(result.deliveryKey).toBe('delivery-1');
    expect(result.claimToken).toEqual(expect.any(String));
    expect(redisMocks.set).toHaveBeenCalledWith(
      'gurusthalam:notification:idempotency:delivery-1',
      `processing:${result.claimToken}`,
      'EX',
      300,
      'NX',
    );
  });

  it('reports accepted when the existing Redis value is accepted', async () => {
    redisMocks.set.mockResolvedValueOnce(null);
    redisMocks.get.mockResolvedValueOnce('accepted');

    await expect(service.claim('delivery-accepted')).resolves.toEqual({
      status: 'accepted',
      deliveryKey: 'delivery-accepted',
    });
  });

  it('reports in_progress for an existing processing claim', async () => {
    redisMocks.set.mockResolvedValueOnce(null);
    redisMocks.get.mockResolvedValueOnce('processing:another-worker-token');

    await expect(service.claim('delivery-busy')).resolves.toEqual({
      status: 'in_progress',
      deliveryKey: 'delivery-busy',
    });
  });

  it('retries SET NX once if the key disappears between the initial claim and read', async () => {
    redisMocks.set.mockResolvedValueOnce(null).mockResolvedValueOnce('OK');

    const result = await service.claim('delivery-expired-race');

    expect(result.status).toBe('claimed');
    expect(redisMocks.set).toHaveBeenCalledTimes(2);
    expect(redisMocks.get).toHaveBeenCalledTimes(1);
  });

  it('uses the claim token in the atomic acceptance script and returns true only for owner success', async () => {
    redisMocks.eval.mockResolvedValueOnce(1);

    await expect(
      service.markAccepted('delivery-1', 'owner-token'),
    ).resolves.toBe(true);

    expect(redisMocks.eval).toHaveBeenCalledWith(
      expect.stringContaining('current ~= ARGV[1]'),
      1,
      'gurusthalam:notification:idempotency:delivery-1',
      'processing:owner-token',
      '86400',
    );
  });

  it('returns false when Redis rejects acceptance finalisation for a non-owner', async () => {
    redisMocks.eval.mockResolvedValueOnce(0);

    await expect(
      service.markAccepted('delivery-1', 'not-the-owner'),
    ).resolves.toBe(false);
  });

  it('only releases a claim when the supplied token owns it', async () => {
    redisMocks.eval.mockResolvedValueOnce(1);

    await expect(
      service.releaseClaim('delivery-1', 'owner-token'),
    ).resolves.toBe(true);

    expect(redisMocks.eval).toHaveBeenCalledWith(
      expect.stringContaining('current ~= ARGV[1]'),
      1,
      'gurusthalam:notification:idempotency:delivery-1',
      'processing:owner-token',
    );
  });

  it('does not release a claim owned by another worker', async () => {
    redisMocks.eval.mockResolvedValueOnce(0);

    await expect(
      service.releaseClaim('delivery-1', 'not-the-owner'),
    ).resolves.toBe(false);
  });

  it('rejects blank delivery keys and claim tokens before issuing Redis commands', async () => {
    await expect(service.claim('   ')).rejects.toThrow(
      'Notification delivery key must not be empty.',
    );
    await expect(service.markAccepted('delivery-1', '  ')).rejects.toThrow(
      'Notification claim token must not be empty.',
    );
    await expect(service.releaseClaim('delivery-1', '')).rejects.toThrow(
      'Notification claim token must not be empty.',
    );
    expect(redisMocks.set).not.toHaveBeenCalled();
    expect(redisMocks.eval).not.toHaveBeenCalled();
  });

  it('checks accepted state without mutating it and closes Redis cleanly', async () => {
    redisMocks.get.mockResolvedValueOnce('accepted');

    await expect(service.isAccepted('delivery-1')).resolves.toBe(true);
    expect(redisMocks.get).toHaveBeenCalledWith(
      'gurusthalam:notification:idempotency:delivery-1',
    );

    await expect(service.close()).resolves.toBeUndefined();
    expect(redisMocks.quit).toHaveBeenCalledOnce();
  });
});
