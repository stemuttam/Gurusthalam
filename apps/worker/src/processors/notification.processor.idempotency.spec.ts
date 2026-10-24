import type { Job } from 'bullmq';

import { describe, expect, it, vi } from 'vitest';
import { NotificationAttemptOwnershipLostError } from '../notifications/notification-attempt-ownership.error.js';

import {
  NotificationProcessor,
  type NotificationJobData,
} from './notification.processor.js';

describe('NotificationProcessor delivery idempotency', () => {
  const providerSend = vi.fn();

  const providerName = 'development-email';

  const providerRegistry = {
    get: vi.fn(() => ({
      send: providerSend,
    })),
  };

  const persistence = {
    markProcessing: vi.fn(),

    claimPrimaryAttempt: vi.fn(),

    reconcileSentFromDelivery: vi.fn(),

    markSent: vi.fn(),

    markRetrying: vi.fn(),

    markFailed: vi.fn(),
  };

  const deliveryPersistence = {
    createIfMissing: vi.fn(),

    getByDeliveryKey: vi.fn(),

    markProcessing: vi.fn(),

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
    notificationId: 'phase-3-2-8-delivery-001',

    channel: 'email',

    recipient: {
      userId: 'user-phase-3-2-8',

      email: 'phase-3-2-8@gurusthalam.local',
    },

    subject: 'Delivery idempotency test',

    title: 'Delivery idempotency test',

    body: 'Delivery idempotency verification.',

    idempotencyKey: 'phase-3-2-8-delivery-001',
  };

  const createJob = (
    attemptsMade = 0,

    deliveryKey?: string,
  ): Job<NotificationJobData> =>
    ({
      id: 'job-phase-3-2-8-001',

      attemptsMade,

      data: {
        ...notification,

        ...(deliveryKey !== undefined
          ? {
              deliveryKey,
            }
          : {}),
      },
    }) as unknown as Job<NotificationJobData>;

  function resetMocks(): void {
    providerSend.mockReset();

    providerRegistry.get.mockClear();

    persistence.markProcessing.mockReset();

    persistence.claimPrimaryAttempt.mockReset();

    persistence.reconcileSentFromDelivery.mockReset();

    persistence.markSent.mockReset();

    persistence.markRetrying.mockReset();

    persistence.markFailed.mockReset();

    deliveryPersistence.createIfMissing.mockReset();

    deliveryPersistence.getByDeliveryKey.mockReset();

    deliveryPersistence.markProcessing.mockReset();

    deliveryPersistence.markSent.mockReset();

    deliveryPersistence.markRetrying.mockReset();

    deliveryPersistence.markFailed.mockReset();

    metrics.incrementProcessing.mockReset();

    metrics.incrementIdempotentHits.mockReset();

    metrics.incrementProviderIdempotentHits.mockReset();

    metrics.incrementSent.mockReset();

    metrics.incrementProviderSent.mockReset();

    metrics.incrementRetrying.mockReset();

    metrics.incrementProviderRetrying.mockReset();

    metrics.incrementFailed.mockReset();

    metrics.incrementProviderFailed.mockReset();

    metrics.incrementProviderErrorsFor.mockReset();

    metrics.recordLatency.mockReset();

    metrics.recordProviderLatency.mockReset();

    logger.info.mockReset();

    logger.error.mockReset();

    logger.warn.mockReset();
  }

  it('invokes the provider for the first delivery', async () => {
    resetMocks();

    deliveryPersistence.createIfMissing.mockResolvedValue({
      status: 'PENDING',

      providerMessageId: null,
    });

    deliveryPersistence.getByDeliveryKey.mockResolvedValue({
      status: 'PENDING',

      providerMessageId: null,
    });

    providerSend.mockResolvedValue({
      accepted: true,

      classification: 'SUCCESS',

      provider: providerName,

      messageId: 'provider-message-001',
    });

    const result = await processor.process(createJob());

    expect(providerSend).toHaveBeenCalledTimes(1);
    expect(
      persistence.claimPrimaryAttempt.mock.invocationCallOrder[0],
    ).toBeLessThan(
      providerSend.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );

    expect(providerSend).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationId: notification.notificationId,
      }),

      expect.objectContaining({
        deliveryKey: expect.any(String),
      }),
    );

    expect(deliveryPersistence.markSent).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'provider-message-001',
    );

    expect(persistence.claimPrimaryAttempt).toHaveBeenCalledTimes(1);
    expect(persistence.claimPrimaryAttempt).toHaveBeenCalledWith(
      notification,
      expect.any(String),
      1,
      expect.any(String),
      expect.any(String),
    );

    expect(persistence.markSent).toHaveBeenCalledWith(
      notification.notificationId,
      expect.any(String),
      providerName,
      'provider-message-001',
    );

    expect(result).toEqual({
      processed: true,

      notificationId: notification.notificationId,

      channel: 'email',

      provider: providerName,

      messageId: 'provider-message-001',
    });
  });

  it('skips the provider when the delivery is already SENT', async () => {
    resetMocks();

    deliveryPersistence.createIfMissing.mockResolvedValue({
      status: 'SENT',

      provider: providerName,

      providerMessageId: 'provider-message-existing',
    });

    deliveryPersistence.getByDeliveryKey.mockResolvedValue({
      status: 'SENT',

      provider: providerName,

      providerMessageId: 'provider-message-existing',
    });

    const result = await processor.process(createJob());

    expect(providerSend).not.toHaveBeenCalled();

    expect(persistence.reconcileSentFromDelivery).toHaveBeenCalledWith(
      notification.notificationId,
      providerName,
      'provider-message-existing',
    );

    expect(metrics.incrementIdempotentHits).toHaveBeenCalledTimes(1);

    expect(metrics.incrementProviderIdempotentHits).toHaveBeenCalledWith(
      providerName,
    );

    expect(persistence.markProcessing).not.toHaveBeenCalled();

    expect(persistence.claimPrimaryAttempt).not.toHaveBeenCalled();

    expect(persistence.markSent).not.toHaveBeenCalled();

    expect(result).toEqual({
      processed: true,

      notificationId: notification.notificationId,

      channel: 'email',

      provider: providerName,

      messageId: 'provider-message-existing',
    });
  });

  it('returns the persisted provider message ID during an idempotent replay', async () => {
    resetMocks();

    deliveryPersistence.createIfMissing.mockResolvedValue({
      status: 'SENT',

      provider: providerName,

      providerMessageId: 'provider-message-777',
    });

    deliveryPersistence.getByDeliveryKey.mockResolvedValue({
      status: 'SENT',

      provider: providerName,

      providerMessageId: 'provider-message-777',
    });

    const result = await processor.process(createJob(1));

    expect(result.messageId).toBe('provider-message-777');

    expect(providerSend).not.toHaveBeenCalled();

    expect(persistence.markProcessing).not.toHaveBeenCalled();

    expect(persistence.claimPrimaryAttempt).not.toHaveBeenCalled();

    expect(persistence.markSent).not.toHaveBeenCalled();
  });

  it('uses the supplied deliveryKey for replay processing', async () => {
    resetMocks();

    const replayDeliveryKey = 'replay-delivery-key-001';

    deliveryPersistence.createIfMissing.mockResolvedValue({
      status: 'PENDING',

      providerMessageId: null,
    });

    deliveryPersistence.getByDeliveryKey.mockResolvedValue({
      status: 'PENDING',

      providerMessageId: null,
    });

    providerSend.mockResolvedValue({
      accepted: true,

      classification: 'SUCCESS',

      provider: providerName,

      messageId: 'provider-replay-001',
    });

    await processor.process(
      createJob(
        0,

        replayDeliveryKey,
      ),
    );

    expect(deliveryPersistence.createIfMissing).toHaveBeenCalledWith(
      notification.notificationId,

      replayDeliveryKey,

      providerName,

      'EMAIL',
    );

    expect(providerSend).toHaveBeenCalledWith(
      expect.any(Object),

      {
        deliveryKey: replayDeliveryKey,
      },
    );

    expect(persistence.markProcessing).not.toHaveBeenCalled();

    expect(persistence.claimPrimaryAttempt).not.toHaveBeenCalled();

    expect(persistence.markSent).not.toHaveBeenCalled();

    expect(deliveryPersistence.markProcessing).toHaveBeenCalledWith(
      replayDeliveryKey,
      1,
      expect.any(String),
    );

    expect(deliveryPersistence.markSent).toHaveBeenCalledWith(
      replayDeliveryKey,
      expect.any(String),
      'provider-replay-001',
    );
  });

  it('does not mutate the parent Notification lifecycle for a replay', async () => {
    resetMocks();

    const replayDeliveryKey = 'replay-parent-isolation-001';

    deliveryPersistence.createIfMissing.mockResolvedValue({
      status: 'PENDING',

      providerMessageId: null,
    });

    deliveryPersistence.getByDeliveryKey.mockResolvedValue({
      status: 'PENDING',

      providerMessageId: null,
    });

    providerSend.mockResolvedValue({
      accepted: true,

      classification: 'SUCCESS',

      provider: providerName,

      messageId: 'provider-replay-isolation-001',
    });

    await processor.process(
      createJob(
        0,

        replayDeliveryKey,
      ),
    );

    expect(persistence.markProcessing).not.toHaveBeenCalled();

    expect(persistence.markSent).not.toHaveBeenCalled();

    expect(deliveryPersistence.markProcessing).toHaveBeenCalledWith(
      replayDeliveryKey,
      1,
      expect.any(String),
    );

    expect(deliveryPersistence.markSent).toHaveBeenCalledWith(
      replayDeliveryKey,
      expect.any(String),
      'provider-replay-isolation-001',
    );
  });

  it('does not mutate the parent Notification lifecycle when a replay delivery fails', async () => {
    resetMocks();

    const replayDeliveryKey = 'replay-failure-isolation-001';

    deliveryPersistence.createIfMissing.mockResolvedValue({
      status: 'PENDING',

      providerMessageId: null,
    });

    deliveryPersistence.getByDeliveryKey.mockResolvedValue({
      status: 'PENDING',

      providerMessageId: null,
    });

    providerSend.mockRejectedValue(
      new Error('Simulated replay provider failure.'),
    );

    await expect(
      processor.process(
        createJob(
          0,

          replayDeliveryKey,
        ),
      ),
    ).rejects.toThrow('Simulated replay provider failure.');

    expect(deliveryPersistence.markFailed).toHaveBeenCalledWith(
      replayDeliveryKey,
      expect.any(String),
      'Simulated replay provider failure.',
    );

    expect(persistence.markProcessing).not.toHaveBeenCalled();

    expect(persistence.markRetrying).not.toHaveBeenCalled();

    expect(persistence.markFailed).not.toHaveBeenCalled();
  });

  it('propagates primary ownership loss without calling the provider or persisting failure', async () => {
    resetMocks();
    deliveryPersistence.createIfMissing.mockResolvedValue({
      status: 'PENDING',
    });
    deliveryPersistence.getByDeliveryKey.mockResolvedValue({
      status: 'PENDING',
    });
    const ownershipError = new NotificationAttemptOwnershipLostError(
      'notification',
      notification.notificationId,
    );
    persistence.claimPrimaryAttempt.mockRejectedValue(ownershipError);

    await expect(processor.process(createJob())).rejects.toBe(ownershipError);

    expect(providerSend).not.toHaveBeenCalled();
    expect(deliveryPersistence.markProcessing).not.toHaveBeenCalled();
    expect(deliveryPersistence.markFailed).not.toHaveBeenCalled();
    expect(persistence.markFailed).not.toHaveBeenCalled();
    expect(persistence.markRetrying).not.toHaveBeenCalled();
    expect(metrics.incrementProviderFailed).not.toHaveBeenCalled();
  });
});
