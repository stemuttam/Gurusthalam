import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Job } from 'bullmq';

import {
  NotificationProcessor,
  type NotificationJobData,
} from './notification.processor.js';
import { createNotificationDeliveryKey } from '../notifications/notification-delivery-key.js';

describe('NotificationProcessor provider acceptance boundary', () => {
  const providerSend = vi.fn();

  const providerRegistry = {
    get: vi.fn(() => ({
      send: providerSend,
    })),
  };

  const persistence = {
    claimPrimaryAttempt: vi.fn(),
    reconcileSentFromDelivery: vi.fn(),
    markSent: vi.fn(),
    markRetrying: vi.fn(),
    markFailed: vi.fn(),
    markAcceptanceUnknown: vi.fn(),
  };

  const deliveryPersistence = {
    createIfMissing: vi.fn(),
    getByDeliveryKey: vi.fn(),
    markProcessing: vi.fn(),
    markProviderSubmissionStarted: vi.fn(),
    markAcceptanceUnknown: vi.fn(),
    markSent: vi.fn(),
    markRetrying: vi.fn(),
    markFailed: vi.fn(),
  };

  const metrics = {
    incrementProcessing: vi.fn(),
    incrementIdempotentHits: vi.fn(),
    incrementProviderIdempotentHits: vi.fn(),
    incrementSent: vi.fn(),
    incrementProviderSent: vi.fn(),
    incrementRetrying: vi.fn(),
    incrementProviderRetrying: vi.fn(),
    incrementFailed: vi.fn(),
    incrementProviderFailed: vi.fn(),
    incrementProviderErrorsFor: vi.fn(),
    recordLatency: vi.fn(),
    recordProviderLatency: vi.fn(),
  };

  const logger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  };

  const processor = new NotificationProcessor(
    logger as never,
    providerRegistry as never,
    persistence as never,
    deliveryPersistence as never,
    metrics as never,
  );

  const notification: NotificationJobData = {
    notificationId: 'p2-1-c-acceptance-boundary-001',
    channel: 'email',
    recipient: {
      userId: 'p2-1-c-user-001',
      email: 'p2-1-c@example.invalid',
    },
    subject: 'Acceptance boundary regression',
    title: 'Acceptance boundary regression',
    body: 'Test notification.',
    idempotencyKey: 'p2-1-c-acceptance-boundary-001',
  };

  const deliveryKey = createNotificationDeliveryKey(
    notification.notificationId,
    notification.channel,
    'development-email',
  );

  function createJob(attemptsMade = 0): Job<NotificationJobData> {
    return {
      id: 'p2-1-c-job-001',
      attemptsMade,
      data: notification,
    } as unknown as Job<NotificationJobData>;
  }

  function resetMocks(): void {
    for (const mock of [
      providerSend,
      providerRegistry.get,
      persistence.claimPrimaryAttempt,
      persistence.reconcileSentFromDelivery,
      persistence.markSent,
      persistence.markRetrying,
      persistence.markFailed,
      persistence.markAcceptanceUnknown,
      deliveryPersistence.createIfMissing,
      deliveryPersistence.getByDeliveryKey,
      deliveryPersistence.markProcessing,
      deliveryPersistence.markProviderSubmissionStarted,
      deliveryPersistence.markAcceptanceUnknown,
      deliveryPersistence.markSent,
      deliveryPersistence.markRetrying,
      deliveryPersistence.markFailed,
      metrics.incrementProcessing,
      metrics.incrementIdempotentHits,
      metrics.incrementProviderIdempotentHits,
      metrics.incrementSent,
      metrics.incrementProviderSent,
      metrics.incrementRetrying,
      metrics.incrementProviderRetrying,
      metrics.incrementFailed,
      metrics.incrementProviderFailed,
      metrics.incrementProviderErrorsFor,
      metrics.recordLatency,
      metrics.recordProviderLatency,
      logger.info,
      logger.error,
      logger.warn,
    ]) {
      mock.mockReset();
    }

    deliveryPersistence.createIfMissing.mockResolvedValue({
      status: 'PENDING',
      providerMessageId: null,
    });
    deliveryPersistence.getByDeliveryKey.mockResolvedValue({
      status: 'PENDING',
      providerMessageId: null,
    });
    deliveryPersistence.markProviderSubmissionStarted.mockResolvedValue(
      undefined,
    );
    deliveryPersistence.markSent.mockResolvedValue(undefined);
    deliveryPersistence.markAcceptanceUnknown.mockResolvedValue(undefined);
    persistence.claimPrimaryAttempt.mockResolvedValue(undefined);
    persistence.markSent.mockResolvedValue(undefined);
    persistence.markRetrying.mockResolvedValue(undefined);
    persistence.markFailed.mockResolvedValue(undefined);
    providerRegistry.get.mockReturnValue({ send: providerSend });
  }

  beforeEach(() => {
    resetMocks();
  });

  it('persists confirmed provider acceptance as SENT and returns the real message ID', async () => {
    providerSend.mockResolvedValue({
      accepted: true,
      provider: 'development-email',
      channel: 'email',
      notificationId: notification.notificationId,
      messageId: 'provider-message-p2-1-c-001',
      classification: 'SUCCESS',
    });

    const result = await processor.process(createJob());

    expect(result).toEqual({
      processed: true,
      notificationId: notification.notificationId,
      channel: 'email',
      provider: 'development-email',
      messageId: 'provider-message-p2-1-c-001',
    });

    expect(
      deliveryPersistence.markProviderSubmissionStarted.mock
        .invocationCallOrder[0],
    ).toBeLessThan(providerSend.mock.invocationCallOrder[0] ?? Infinity);
    expect(providerSend.mock.invocationCallOrder[0]).toBeLessThan(
      deliveryPersistence.markSent.mock.invocationCallOrder[0] ?? Infinity,
    );
    expect(
      deliveryPersistence.markSent.mock.invocationCallOrder[0],
    ).toBeLessThan(
      persistence.markSent.mock.invocationCallOrder[0] ?? Infinity,
    );

    expect(deliveryPersistence.markSent).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'provider-message-p2-1-c-001',
    );
    expect(persistence.markSent).toHaveBeenCalledWith(
      notification.notificationId,
      expect.any(String),
      'development-email',
      'provider-message-p2-1-c-001',
    );
    expect(deliveryPersistence.markAcceptanceUnknown).not.toHaveBeenCalled();
    expect(deliveryPersistence.markFailed).not.toHaveBeenCalled();
    expect(deliveryPersistence.markRetrying).not.toHaveBeenCalled();
  });

  it('treats SUCCESS without a message ID as uncertain and blocks automatic resend', async () => {
    providerSend.mockResolvedValue({
      accepted: true,
      provider: 'development-email',
      channel: 'email',
      notificationId: notification.notificationId,
      classification: 'SUCCESS',
    });

    const result = await processor.process(createJob());

    expect(result).toEqual({
      processed: true,
      notificationId: notification.notificationId,
      channel: 'email',
      provider: 'development-email',
      messageId: `acceptance-unknown:${deliveryKey}`,
    });

    expect(
      deliveryPersistence.markProviderSubmissionStarted,
    ).toHaveBeenCalledWith(expect.any(String), expect.any(String));
    expect(deliveryPersistence.markAcceptanceUnknown).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.stringContaining('without a valid messageId'),
    );
    expect(deliveryPersistence.markSent).not.toHaveBeenCalled();
    expect(deliveryPersistence.markFailed).not.toHaveBeenCalled();
    expect(deliveryPersistence.markRetrying).not.toHaveBeenCalled();
    expect(persistence.markSent).not.toHaveBeenCalled();
    expect(persistence.markFailed).not.toHaveBeenCalled();
    expect(persistence.markRetrying).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('automatic resend is blocked'),
      expect.any(Error),
      expect.objectContaining({
        operation: 'notification.delivery.acceptance_unknown',
      }),
    );
  });

  it('keeps acceptance uncertain if delivery SENT persistence fails after provider success', async () => {
    const persistenceError = new Error(
      'PostgreSQL failed while persisting the provider message ID.',
    );

    providerSend.mockResolvedValue({
      accepted: true,
      provider: 'development-email',
      channel: 'email',
      notificationId: notification.notificationId,
      messageId: 'provider-message-p2-1-c-002',
      classification: 'SUCCESS',
    });
    deliveryPersistence.markSent.mockRejectedValue(persistenceError);

    const result = await processor.process(createJob());

    expect(result).toEqual({
      processed: true,
      notificationId: notification.notificationId,
      channel: 'email',
      provider: 'development-email',
      messageId: `acceptance-unknown:${deliveryKey}`,
    });

    expect(deliveryPersistence.markAcceptanceUnknown).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      persistenceError.message,
    );
    expect(persistence.markSent).not.toHaveBeenCalled();
    expect(deliveryPersistence.markFailed).not.toHaveBeenCalled();
    expect(deliveryPersistence.markRetrying).not.toHaveBeenCalled();
    expect(persistence.markRetrying).not.toHaveBeenCalled();
    expect(persistence.markFailed).not.toHaveBeenCalled();
  });

  it('treats a provider transport exception after submission starts as uncertain', async () => {
    const providerError = new Error('Provider timed out after submission.');
    providerSend.mockRejectedValue(providerError);

    const result = await processor.process(createJob());

    expect(result).toEqual({
      processed: true,
      notificationId: notification.notificationId,
      channel: 'email',
      provider: 'development-email',
      messageId: `acceptance-unknown:${deliveryKey}`,
    });

    expect(
      deliveryPersistence.markProviderSubmissionStarted.mock
        .invocationCallOrder[0],
    ).toBeLessThan(providerSend.mock.invocationCallOrder[0] ?? Infinity);
    expect(deliveryPersistence.markAcceptanceUnknown).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      providerError.message,
    );
    expect(deliveryPersistence.markFailed).not.toHaveBeenCalled();
    expect(deliveryPersistence.markRetrying).not.toHaveBeenCalled();
    expect(persistence.markFailed).not.toHaveBeenCalled();
    expect(persistence.markRetrying).not.toHaveBeenCalled();
  });
});
