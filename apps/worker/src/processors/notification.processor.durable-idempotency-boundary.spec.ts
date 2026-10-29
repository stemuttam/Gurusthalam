import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Job } from 'bullmq';

import {
  NotificationProcessor,
  type NotificationJobData,
} from './notification.processor.js';
import { createNotificationDeliveryKey } from '../notifications/notification-delivery-key.js';
import { NotificationAttemptOwnershipLostError } from '../notifications/notification-attempt-ownership.error.js';

describe('NotificationProcessor durable PostgreSQL vs Redis boundary', () => {
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
    notificationId: 'p2-2-d-boundary-001',
    channel: 'email',
    recipient: {
      userId: 'p2-2-d-user-001',
      email: 'p2-2-d@example.invalid',
    },
    subject: 'Durable boundary regression',
    title: 'Durable boundary regression',
    body: 'Test notification.',
    idempotencyKey: 'p2-2-d-boundary-001',
  };

  const deliveryKey = createNotificationDeliveryKey(
    notification.notificationId,
    notification.channel,
    'development-email',
  );

  function createJob(): Job<NotificationJobData> {
    return {
      id: 'p2-2-d-job-001',
      attemptsMade: 0,
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

    providerRegistry.get.mockReturnValue({ send: providerSend });

    deliveryPersistence.createIfMissing.mockResolvedValue(undefined);

    deliveryPersistence.getByDeliveryKey.mockResolvedValue({
      id: 'p2-2-d-delivery-001',
      notificationId: notification.notificationId,
      deliveryKey,
      provider: 'development-email',
      channel: 'EMAIL',
      status: 'PENDING',
      attempts: 1,
      providerMessageId: null,
      lastAttemptAt: null,
      sentAt: null,
      failedAt: null,
      failureReason: null,
      activeAttemptToken: null,
      providerSubmissionStartedAt: null,
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
      updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    });

    persistence.claimPrimaryAttempt.mockResolvedValue(undefined);
    persistence.reconcileSentFromDelivery.mockResolvedValue(undefined);
    deliveryPersistence.markProviderSubmissionStarted.mockResolvedValue(
      undefined,
    );
    deliveryPersistence.markSent.mockResolvedValue(undefined);
    deliveryPersistence.markAcceptanceUnknown.mockResolvedValue(undefined);
    deliveryPersistence.markFailed.mockResolvedValue(undefined);
    deliveryPersistence.markRetrying.mockResolvedValue(undefined);
    persistence.markSent.mockResolvedValue(undefined);
    persistence.markAcceptanceUnknown.mockResolvedValue(undefined);
    persistence.markFailed.mockResolvedValue(undefined);
    persistence.markRetrying.mockResolvedValue(undefined);
  }

  beforeEach(resetMocks);

  it('uses PostgreSQL SENT state when the Redis accepted key has expired', async () => {
    deliveryPersistence.getByDeliveryKey.mockResolvedValue({
      id: 'p2-2-d-delivery-sent',
      notificationId: notification.notificationId,
      deliveryKey,
      provider: 'development-email',
      channel: 'EMAIL',
      status: 'SENT',
      attempts: 1,
      providerMessageId: 'durable-provider-message-001',
      lastAttemptAt: null,
      sentAt: new Date('2026-10-01T00:00:00.000Z'),
      failedAt: null,
      failureReason: null,
      activeAttemptToken: null,
      providerSubmissionStartedAt: null,
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
      updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    });

    const result = await processor.process(createJob());

    expect(result).toEqual({
      processed: true,
      notificationId: notification.notificationId,
      channel: 'email',
      provider: 'development-email',
      messageId: 'durable-provider-message-001',
    });

    expect(persistence.reconcileSentFromDelivery).toHaveBeenCalledWith(
      notification.notificationId,
      'development-email',
      'durable-provider-message-001',
    );

    // The provider is the component that consults Redis. It must not be
    // invoked when PostgreSQL already proves that this delivery was sent.
    expect(providerSend).not.toHaveBeenCalled();
    expect(persistence.claimPrimaryAttempt).not.toHaveBeenCalled();
    expect(
      deliveryPersistence.markProviderSubmissionStarted,
    ).not.toHaveBeenCalled();
    expect(metrics.incrementIdempotentHits).toHaveBeenCalledOnce();
  });

  it('does not resubmit when PostgreSQL parent state is ACCEPTANCE_UNKNOWN and Redis state is absent', async () => {
    deliveryPersistence.getByDeliveryKey.mockResolvedValue({
      id: 'p2-2-d-delivery-unknown',
      notificationId: notification.notificationId,
      deliveryKey,
      provider: 'development-email',
      channel: 'EMAIL',
      status: 'ACCEPTANCE_UNKNOWN',
      attempts: 1,
      providerMessageId: null,
      lastAttemptAt: new Date('2026-10-01T00:00:00.000Z'),
      sentAt: null,
      failedAt: null,
      failureReason: 'Provider outcome could not be determined.',
      activeAttemptToken: null,
      providerSubmissionStartedAt: new Date('2026-10-01T00:00:00.000Z'),
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
      updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    });

    // This models the real PostgreSQL ownership guard: a terminal
    // ACCEPTANCE_UNKNOWN parent cannot be claimed for a new submission.
    persistence.claimPrimaryAttempt.mockRejectedValue(
      new NotificationAttemptOwnershipLostError(
        'notification',
        notification.notificationId,
      ),
    );

    await expect(processor.process(createJob())).rejects.toBeInstanceOf(
      NotificationAttemptOwnershipLostError,
    );

    expect(persistence.claimPrimaryAttempt).toHaveBeenCalledOnce();
    expect(providerSend).not.toHaveBeenCalled();
    expect(
      deliveryPersistence.markProviderSubmissionStarted,
    ).not.toHaveBeenCalled();
    expect(deliveryPersistence.markSent).not.toHaveBeenCalled();
    expect(deliveryPersistence.markFailed).not.toHaveBeenCalled();
    expect(deliveryPersistence.markRetrying).not.toHaveBeenCalled();
  });
});
