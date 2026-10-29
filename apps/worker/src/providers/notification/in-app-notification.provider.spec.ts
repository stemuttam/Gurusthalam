import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NotificationJobData } from '../../processors/notification.processor.js';
import { InAppNotificationProvider } from './in-app-notification.provider.js';
import { NotificationFailureClassification } from './notification-provider-result.types.js';
import type { NotificationIdempotencyClaim } from './notification-idempotency.service.js';

describe('InAppNotificationProvider idempotency', () => {
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

  let provider: InAppNotificationProvider;

  const notification = {
    notificationId: 'notification-in-app-1',
    channel: 'in-app',
  } as NotificationJobData;

  const context = { deliveryKey: 'delivery-in-app-1' };

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new InAppNotificationProvider(
      logger as never,
      idempotency as never,
    );
  });

  it('returns a deterministic synthetic identity for a previously accepted delivery', async () => {
    idempotency.claim.mockResolvedValue({
      status: 'accepted',
      deliveryKey: context.deliveryKey,
    } satisfies NotificationIdempotencyClaim);

    await expect(provider.send(notification, context)).resolves.toEqual({
      accepted: true,
      provider: 'development-in-app',
      channel: 'in-app',
      notificationId: notification.notificationId,
      messageId: 'dev-in-app-delivery-in-app-1',
      classification: NotificationFailureClassification.SUCCESS,
    });

    expect(idempotency.markAccepted).not.toHaveBeenCalled();
  });

  it('does not report acceptance while another claim is in progress', async () => {
    idempotency.claim.mockResolvedValue({
      status: 'in_progress',
      deliveryKey: context.deliveryKey,
    } satisfies NotificationIdempotencyClaim);

    await expect(provider.send(notification, context)).rejects.toThrow(
      `Notification delivery is already in progress: ${context.deliveryKey}`,
    );

    expect(idempotency.markAccepted).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('finalizes acceptance only with the claim token returned by claim()', async () => {
    idempotency.claim.mockResolvedValue({
      status: 'claimed',
      deliveryKey: context.deliveryKey,
      claimToken: 'owner-token',
    } satisfies NotificationIdempotencyClaim);
    idempotency.markAccepted.mockResolvedValue(true);

    const result = await provider.send(notification, context);

    expect(idempotency.markAccepted).toHaveBeenCalledWith(
      context.deliveryKey,
      'owner-token',
    );
    expect(result).toMatchObject({
      accepted: true,
      provider: 'development-in-app',
      messageId: 'dev-in-app-delivery-in-app-1',
      classification: NotificationFailureClassification.SUCCESS,
    });
  });

  it('never reports acceptance if ownership is lost before finalization', async () => {
    idempotency.claim.mockResolvedValue({
      status: 'claimed',
      deliveryKey: context.deliveryKey,
      claimToken: 'expired-owner-token',
    } satisfies NotificationIdempotencyClaim);
    idempotency.markAccepted.mockResolvedValue(false);

    await expect(provider.send(notification, context)).rejects.toThrow(
      `Could not finalise notification delivery claim: ${context.deliveryKey}`,
    );

    expect(idempotency.releaseClaim).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('propagates Redis claim errors instead of reporting acceptance', async () => {
    idempotency.claim.mockRejectedValue(new Error('Redis unavailable'));

    await expect(provider.send(notification, context)).rejects.toThrow(
      'Redis unavailable',
    );

    expect(idempotency.markAccepted).not.toHaveBeenCalled();
  });

  it('does not release a claim when acceptance finalization errors', async () => {
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
