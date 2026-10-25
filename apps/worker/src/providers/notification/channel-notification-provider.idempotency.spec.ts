import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NotificationJobData } from '../../processors/notification.processor.js';

import { InAppNotificationProvider } from './in-app-notification.provider.js';
import { PushNotificationProvider } from './push-notification.provider.js';
import type { NotificationIdempotencyClaim } from './notification-idempotency.service.js';

import { NotificationFailureClassification } from './notification-provider-result.types.js';

const channels = [
  {
    channel: 'in-app' as const,
    provider: 'development-in-app',
    prefix: 'dev-in-app',
    create: (logger: never, idempotency: never) =>
      new InAppNotificationProvider(logger, idempotency),
  },
  {
    channel: 'push' as const,
    provider: 'development-push',
    prefix: 'dev-push',
    create: (logger: never, idempotency: never) =>
      new PushNotificationProvider(logger, idempotency),
  },
] as const;

describe.each(channels)('$channel provider idempotency', (config) => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  const idempotency = {
    claim: vi.fn(),
    markAccepted: vi.fn(),
    releaseClaim: vi.fn(),
    isAccepted: vi.fn(),
    close: vi.fn(),
  };

  const notification = {
    notificationId: 'channel-notification-001',
    channel: config.channel,
    recipient: { userId: 'learner-001' },
    title: 'Progress updated',
    body: 'Your learning progress has been updated.',
    idempotencyKey: 'channel-idempotency-001',
  } as NotificationJobData;

  const context = { deliveryKey: 'canonical-delivery-001' };

  let provider: ReturnType<typeof config.create>;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = config.create(logger as never, idempotency as never);
  });

  it('claims the canonical delivery key and finalizes with its ownership token', async () => {
    idempotency.claim.mockResolvedValue({
      status: 'claimed',
      deliveryKey: context.deliveryKey,
      claimToken: 'owner-token',
    } satisfies NotificationIdempotencyClaim);
    idempotency.markAccepted.mockResolvedValue(true);

    const result = await provider.send(notification, context);

    expect(idempotency.claim).toHaveBeenCalledWith(context.deliveryKey);
    expect(idempotency.markAccepted).toHaveBeenCalledWith(
      context.deliveryKey,
      'owner-token',
    );
    expect(result).toEqual({
      accepted: true,
      provider: config.provider,
      channel: config.channel,
      notificationId: notification.notificationId,
      messageId: `${config.prefix}-${context.deliveryKey}`,
      classification: NotificationFailureClassification.SUCCESS,
    });
    expect(idempotency.releaseClaim).not.toHaveBeenCalled();
  });

  it('returns a deterministic result for an already accepted delivery without claiming acceptance again', async () => {
    idempotency.claim.mockResolvedValue({
      status: 'accepted',
      deliveryKey: context.deliveryKey,
    } satisfies NotificationIdempotencyClaim);

    const result = await provider.send(notification, context);

    expect(result.accepted).toBe(true);
    expect(result.provider).toBe(config.provider);
    expect(result.messageId).toBe(`${config.prefix}-${context.deliveryKey}`);
    expect(idempotency.markAccepted).not.toHaveBeenCalled();
    expect(idempotency.releaseClaim).not.toHaveBeenCalled();
  });

  it('does not report success when another worker owns the active claim', async () => {
    idempotency.claim.mockResolvedValue({
      status: 'in_progress',
      deliveryKey: context.deliveryKey,
    } satisfies NotificationIdempotencyClaim);

    await expect(provider.send(notification, context)).rejects.toThrow(
      `Notification delivery is already in progress: ${context.deliveryKey}`,
    );

    expect(idempotency.markAccepted).not.toHaveBeenCalled();
    expect(idempotency.releaseClaim).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('does not report success or release the claim if ownership is lost', async () => {
    idempotency.claim.mockResolvedValue({
      status: 'claimed',
      deliveryKey: context.deliveryKey,
      claimToken: 'expired-owner-token',
    } satisfies NotificationIdempotencyClaim);
    idempotency.markAccepted.mockResolvedValue(false);

    await expect(provider.send(notification, context)).rejects.toThrow(
      `Could not finalise notification delivery claim: ${context.deliveryKey}`,
    );

    expect(idempotency.markAccepted).toHaveBeenCalledWith(
      context.deliveryKey,
      'expired-owner-token',
    );
    expect(idempotency.releaseClaim).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('propagates Redis claim failures rather than returning success', async () => {
    idempotency.claim.mockRejectedValue(new Error('Redis unavailable'));

    await expect(provider.send(notification, context)).rejects.toThrow(
      'Redis unavailable',
    );

    expect(idempotency.markAccepted).not.toHaveBeenCalled();
    expect(idempotency.releaseClaim).not.toHaveBeenCalled();
  });

  it('propagates acceptance-finalization failures without releasing the claim', async () => {
    idempotency.claim.mockResolvedValue({
      status: 'claimed',
      deliveryKey: context.deliveryKey,
      claimToken: 'owner-token',
    } satisfies NotificationIdempotencyClaim);
    idempotency.markAccepted.mockRejectedValue(
      new Error('Redis command timed out'),
    );

    await expect(provider.send(notification, context)).rejects.toThrow(
      'Redis command timed out',
    );

    expect(idempotency.releaseClaim).not.toHaveBeenCalled();
  });
});
