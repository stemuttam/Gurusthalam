import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  NotificationFailureClassification,
} from '../providers/notification/notification-provider-result.types.js';

import {
  NotificationFallbackExecutor,
} from './notification-fallback.executor.js';

import type {
  NotificationJobData,
  NotificationFallbackMetadata,
} from '../processors/notification.processor.js';

function createNotification(): NotificationJobData {
  return {
    notificationId: 'fallback-correlation-001',
    channel: 'email',
    recipient: {
      userId: 'fallback-user-001',
      email: 'fallback@example.com',
    },
    body: 'Fallback lifecycle correlation test',
    idempotencyKey: 'fallback-correlation-key:email',
  };
}

function createMetadata(): NotificationFallbackMetadata {
  return {
    planId: 'fallback-plan-correlation-001',
    orchestrationId: 'fallback-orchestration-correlation-001',
    primary: 'email',
    fallbacks: ['push', 'in-app'],
    sequence: ['email', 'push', 'in-app'],
    position: 0,
  };
}

function createExecutor(
  pushResult: unknown,
  inAppResult: unknown,
) {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  const metrics = {
    incrementFallbackStarted: vi.fn(),
    incrementFallbackAttempts: vi.fn(),
    incrementFallbackAttemptFailures: vi.fn(),
    incrementFallbackRecovered: vi.fn(),
    incrementFallbackExhausted: vi.fn(),
    incrementFallbackIdempotentHits: vi.fn(),
  };

  const providers = new Map([
    ['push', { send: vi.fn().mockResolvedValue(pushResult) }],
    ['in-app', { send: vi.fn().mockResolvedValue(inAppResult) }],
  ]);

  const providerRegistry = {
    get: vi.fn((channel: 'push' | 'in-app') => {
      const provider = providers.get(channel);
      if (!provider) {
        throw new Error(`Test provider "${channel}" was not registered.`);
      }
      return provider;
    }),
  };

  const deliveryPersistence = {
    createIfMissing: vi.fn().mockResolvedValue(undefined),
    getByDeliveryKey: vi.fn().mockResolvedValue(null),
    markProcessing: vi.fn().mockResolvedValue(undefined),
    markSent: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
  };

  return {
    executor: new NotificationFallbackExecutor(
      logger as never,
      providerRegistry as never,
      deliveryPersistence as never,
      metrics as never,
    ),
    logger,
    metrics,
    deliveryPersistence,
    providers,
  };
}

function expectCorrelation(
  messages: readonly unknown[],
  metadata: NotificationFallbackMetadata,
  notification: NotificationJobData,
) {
  for (const message of messages) {
    expect(String(message)).toContain(notification.notificationId);
    expect(String(message)).toContain(metadata.orchestrationId);
    expect(String(message)).toContain(metadata.planId);
  }
}

describe('NotificationFallbackExecutor lifecycle correlation', () => {
  it('preserves orchestration correlation across a failed attempt and recovery', async () => {
    const notification = createNotification();
    const metadata = createMetadata();

    const { executor, logger } = createExecutor(
      {
        accepted: false,
        provider: 'development-push',
        channel: 'push',
        notificationId: notification.notificationId,
        classification: NotificationFailureClassification.PERMANENT,
        errorMessage: 'Push failed.',
      },
      {
        accepted: true,
        provider: 'development-in-app',
        channel: 'in-app',
        notificationId: notification.notificationId,
        messageId: 'inapp-message-001',
        classification: NotificationFailureClassification.SUCCESS,
      },
    );

    await executor.execute(notification, metadata, 3);

    const infoMessages = logger.info.mock.calls.map(
      ([message]) => String(message),
    );
    const warnMessages = logger.warn.mock.calls.map(
      ([message]) => String(message),
    );

    expectCorrelation(infoMessages, metadata, notification);
    expectCorrelation(warnMessages, metadata, notification);

    expect(infoMessages.some((message) =>
      message.includes('Fallback lifecycle started'))).toBe(true);
    expect(infoMessages.some((message) =>
      message.includes('Fallback attempt started'))).toBe(true);
    expect(infoMessages.some((message) =>
      message.includes('Fallback attempt succeeded'))).toBe(true);
    expect(warnMessages.some((message) =>
      message.includes('Fallback attempt failed'))).toBe(true);
  });

  it('preserves orchestration correlation through idempotent recovery', async () => {
    const notification = createNotification();
    const metadata = createMetadata();

    const { executor, logger, deliveryPersistence } = createExecutor(
      {
        accepted: true,
        provider: 'development-push',
        channel: 'push',
        notificationId: notification.notificationId,
        messageId: 'unused',
        classification: NotificationFailureClassification.SUCCESS,
      },
      {
        accepted: true,
        provider: 'development-in-app',
        channel: 'in-app',
        notificationId: notification.notificationId,
        messageId: 'unused',
        classification: NotificationFailureClassification.SUCCESS,
      },
    );

    deliveryPersistence.getByDeliveryKey.mockResolvedValueOnce({
      status: 'SENT',
      providerMessageId: 'existing-push-message',
    });

    await executor.execute(notification, metadata, 3);

    const infoMessages = logger.info.mock.calls.map(
      ([message]) => String(message),
    );

    expectCorrelation(infoMessages, metadata, notification);
    expect(infoMessages.some((message) =>
      message.includes('Fallback delivery already completed'))).toBe(true);
  });

  it('preserves orchestration correlation through complete fallback exhaustion', async () => {
    const notification = createNotification();
    const metadata = createMetadata();

    const { executor, logger } = createExecutor(
      {
        accepted: false,
        provider: 'development-push',
        channel: 'push',
        notificationId: notification.notificationId,
        classification: NotificationFailureClassification.PERMANENT,
        errorMessage: 'Push failed.',
      },
      {
        accepted: false,
        provider: 'development-in-app',
        channel: 'in-app',
        notificationId: notification.notificationId,
        classification: NotificationFailureClassification.NON_RETRYABLE,
        errorMessage: 'In-app failed.',
      },
    );

    await executor.execute(notification, metadata, 3);

    const infoMessages = logger.info.mock.calls.map(
      ([message]) => String(message),
    );
    const warnMessages = logger.warn.mock.calls.map(
      ([message]) => String(message),
    );

    expectCorrelation(infoMessages, metadata, notification);
    expectCorrelation(warnMessages, metadata, notification);
    expect(warnMessages.some((message) =>
      message.includes('Fallback lifecycle exhausted'))).toBe(true);
  });
});
