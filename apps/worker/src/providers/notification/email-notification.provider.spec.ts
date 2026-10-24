import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NotificationJobData } from '../../processors/notification.processor.js';
import { NotificationFailureClassification } from './notification-provider-result.types.js';
import type { NotificationIdempotencyClaim } from './notification-idempotency.service.js';
import { EmailNotificationProvider } from './email-notification.provider.js';

describe('EmailNotificationProvider idempotency', () => {
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

  let provider: EmailNotificationProvider;

  const notification = {
    notificationId: 'notification-1',
    channel: 'email',
  } as NotificationJobData;

  const context = { deliveryKey: 'delivery-1' };

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new EmailNotificationProvider(
      logger as never,
      idempotency as never,
    );
  });

  it('returns the deterministic message identity for a previously accepted delivery', async () => {
    idempotency.claim.mockResolvedValue({
      status: 'accepted',
      deliveryKey: context.deliveryKey,
    } satisfies NotificationIdempotencyClaim);

    const result = await provider.send(notification, context);

    expect(result).toEqual({
      accepted: true,
      provider: 'development-email',
      channel: 'email',
      notificationId: 'notification-1',
      messageId: 'dev-email-delivery-1',
      classification: NotificationFailureClassification.SUCCESS,
    });
    expect(idempotency.markAccepted).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalled();
  });

  it('does not report success when another worker owns the active claim', async () => {
    idempotency.claim.mockResolvedValue({
      status: 'in_progress',
      deliveryKey: context.deliveryKey,
    } satisfies NotificationIdempotencyClaim);

    await expect(provider.send(notification, context)).rejects.toThrow(
      'Notification delivery is already in progress: delivery-1',
    );

    expect(idempotency.markAccepted).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('finalises acceptance only with the token returned by claim()', async () => {
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
    expect(result.accepted).toBe(true);
    expect(result.messageId).toBe('dev-email-delivery-1');
    expect(result.classification).toBe(
      NotificationFailureClassification.SUCCESS,
    );
  });

  it('never reports success if claim ownership is lost before finalisation', async () => {
    idempotency.claim.mockResolvedValue({
      status: 'claimed',
      deliveryKey: context.deliveryKey,
      claimToken: 'expired-owner-token',
    } satisfies NotificationIdempotencyClaim);
    idempotency.markAccepted.mockResolvedValue(false);

    await expect(provider.send(notification, context)).rejects.toThrow(
      'Could not finalise notification delivery claim: delivery-1',
    );

    expect(idempotency.markAccepted).toHaveBeenCalledWith(
      context.deliveryKey,
      'expired-owner-token',
    );
    expect(logger.info).not.toHaveBeenCalled();
    expect(idempotency.releaseClaim).not.toHaveBeenCalled();
  });

  it('propagates Redis claim errors rather than converting them to success', async () => {
    idempotency.claim.mockRejectedValue(new Error('Redis unavailable'));

    await expect(provider.send(notification, context)).rejects.toThrow(
      'Redis unavailable',
    );

    expect(idempotency.markAccepted).not.toHaveBeenCalled();
  });

  it('propagates acceptance-finalisation errors without releasing an uncertain claim', async () => {
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
