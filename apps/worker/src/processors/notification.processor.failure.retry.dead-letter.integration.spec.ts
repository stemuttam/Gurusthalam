import { createPrismaClient, type PrismaClient } from '@gurusthalam/database';

import { GurusthalamLogger } from '@gurusthalam/logger';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { Job } from 'bullmq';

import {
  NotificationProcessor,
  type NotificationJobData,
} from './notification.processor.js';

import { NotificationPersistenceService } from '../notifications/notification-persistence.service.js';

import { NotificationDeliveryPersistenceService } from '../notifications/notification-delivery-persistence.service.js';

import { NotificationProviderRegistry } from '../providers/notification/notification-provider.registry.js';

import { NotificationProviderFailureSimulator } from '../providers/notification/notification-provider.failure-simulator.js';

import { NotificationFailureClassification } from '../providers/notification/notification-provider-result.types.js';

describe('NotificationProcessor - failure/retry/dead-letter PostgreSQL integration', () => {
  let prisma: PrismaClient;

  let persistence: NotificationPersistenceService;

  let deliveryPersistence: NotificationDeliveryPersistenceService;

  let processor: NotificationProcessor;

  const logger = new GurusthalamLogger({
    service: 'notification-failure-retry-dead-letter-integration-test',

    environment: 'test',
  });

  const prefix = `phase-4-13-e-${Date.now()}`;

  beforeAll(async () => {
    prisma = createPrismaClient();

    await prisma.$connect();

    persistence = new NotificationPersistenceService(prisma);

    deliveryPersistence = new NotificationDeliveryPersistenceService(prisma);

    const failureSimulator = new NotificationProviderFailureSimulator({
      mode: 'retryable',

      retryAfterMs: 1_000,

      errorCode: 'PHASE_4_13_E_SIMULATED_FAILURE',

      errorMessage: 'Phase 4.13-E simulated provider failure.',
    });

    const createProvider = (channel: 'email' | 'in-app' | 'push') => ({
      channel,

      send: vi.fn(),
    });

    const emailProvider = createProvider('email');

    const inAppProvider = createProvider('in-app');

    const pushProvider = createProvider('push');

    const providerRegistry = new NotificationProviderRegistry(
      emailProvider as never,

      inAppProvider as never,

      pushProvider as never,

      failureSimulator,
    );

    const metrics = {
      incrementProcessing: vi.fn(),

      incrementIdempotentHits: vi.fn(),

      incrementProviderIdempotentHits: vi.fn(),

      incrementProviderErrorsFor: vi.fn(),

      incrementRetrying: vi.fn(),

      incrementProviderRetrying: vi.fn(),

      incrementSent: vi.fn(),

      incrementProviderSent: vi.fn(),

      incrementFailed: vi.fn(),

      incrementProviderFailed: vi.fn(),

      recordLatency: vi.fn(),

      recordProviderLatency: vi.fn(),

      incrementFallbackStarted: vi.fn(),

      incrementFallbackAttempts: vi.fn(),

      incrementFallbackAttemptFailures: vi.fn(),

      incrementFallbackRecovered: vi.fn(),

      incrementFallbackExhausted: vi.fn(),

      incrementFallbackIdempotentHits: vi.fn(),
    };

    processor = new NotificationProcessor(
      logger,

      providerRegistry,

      persistence,

      deliveryPersistence,

      metrics as never,
    );
  });

  afterAll(async () => {
    if (!prisma) {
      return;
    }

    await prisma.notification.deleteMany({
      where: {
        notificationId: {
          startsWith: prefix,
        },
      },
    });

    await prisma.$disconnect();
  });

  async function createNotification(
    suffix: string,

    status: 'QUEUED' | 'RETRYING',

    attempts: number,
  ) {
    const notificationId = `${prefix}-${suffix}`;

    const idempotencyKey = `${notificationId}-idempotency`;

    await prisma.notification.create({
      data: {
        notificationId,

        userId: `${notificationId}-user`,

        channel: 'EMAIL',

        status,

        body: `Phase 4.13-E ${suffix}`,

        idempotencyKey,

        attempts,

        queuedAt: new Date(),

        processingAt: status === 'RETRYING' ? new Date() : null,

        sentAt: null,

        failedAt: null,

        failureReason:
          status === 'RETRYING' ? 'Retry budget under test.' : null,

        provider: 'development-email',

        providerMessageId: null,
      },
    });

    return {
      notificationId,

      idempotencyKey,

      userId: `${notificationId}-user`,
    };
  }

  function createJob(
    notificationId: string,

    idempotencyKey: string,

    attemptsMade: number,
  ): Job<NotificationJobData> {
    const data: NotificationJobData = {
      notificationId,

      channel: 'email',

      recipient: {
        userId: `${notificationId}-user`,

        email: `${notificationId}@gurusthalam.local`,
      },

      subject: 'Phase 4.13-E failure test',

      title: 'Failure retry dead-letter integration',

      body: 'Production-bound failure/retry/dead-letter acceptance test.',

      idempotencyKey,
    };

    return {
      id: `job-${notificationId}`,

      attemptsMade,

      data,
    } as Job<NotificationJobData>;
  }

  it('persists RETRYING state after a genuine retryable provider failure', async () => {
    const fixture = await createNotification('retryable', 'QUEUED', 0);

    const job = createJob(
      fixture.notificationId,

      fixture.idempotencyKey,

      0,
    );

    await expect(processor.process(job)).rejects.toThrow(
      'Phase 4.13-E simulated provider failure.',
    );

    const notification = await prisma.notification.findUnique({
      where: {
        notificationId: fixture.notificationId,
      },
    });

    expect(notification).not.toBeNull();

    expect(notification?.status).toBe('RETRYING');

    expect(notification?.attempts).toBe(1);

    expect(notification?.failureReason).toContain(
      'Phase 4.13-E simulated provider failure.',
    );

    expect(notification?.failedAt).toBeNull();

    const delivery = await prisma.notificationDelivery.findFirst({
      where: {
        notificationId: fixture.notificationId,
      },
    });

    expect(delivery).not.toBeNull();

    expect(delivery?.status).toBe('FAILED');

    expect(delivery?.attempts).toBe(1);

    expect(delivery?.failureReason).toContain(
      'Phase 4.13-E simulated provider failure.',
    );
  });

  it('persists terminal FAILED state on exactly the configured final attempt', async () => {
    const fixture = await createNotification('retry-exhausted', 'RETRYING', 2);

    const job = createJob(
      fixture.notificationId,

      fixture.idempotencyKey,

      2,
    );

    const result = await processor.process(job);

    expect(result).toEqual({
      processed: true,

      notificationId: fixture.notificationId,

      channel: 'email',

      provider: 'development-email',

      messageId: `failed-${fixture.notificationId}`,
    });

    const notification = await prisma.notification.findUnique({
      where: {
        notificationId: fixture.notificationId,
      },
    });

    expect(notification).not.toBeNull();

    expect(notification?.status).toBe('FAILED');

    expect(notification?.attempts).toBe(3);

    expect(notification?.failedAt).not.toBeNull();

    expect(notification?.failureReason).toContain(
      'Phase 4.13-E simulated provider failure.',
    );

    const delivery = await prisma.notificationDelivery.findFirst({
      where: {
        notificationId: fixture.notificationId,
      },
    });

    expect(delivery).not.toBeNull();

    expect(delivery?.status).toBe('FAILED');

    expect(delivery?.attempts).toBe(3);

    expect(delivery?.failedAt).not.toBeNull();
  });

  it('does not invoke the processor again after the terminal FAILED boundary', async () => {
    const fixture = await createNotification(
      'terminal-boundary',
      'RETRYING',
      2,
    );

    const finalAttemptJob = createJob(
      fixture.notificationId,

      fixture.idempotencyKey,

      2,
    );

    const result = await processor.process(finalAttemptJob);

    expect(result).toEqual({
      processed: true,

      notificationId: fixture.notificationId,

      channel: 'email',

      provider: 'development-email',

      messageId: `failed-${fixture.notificationId}`,
    });

    const terminalState = await prisma.notification.findUnique({
      where: {
        notificationId: fixture.notificationId,
      },
    });

    expect(terminalState).not.toBeNull();

    expect(terminalState?.status).toBe('FAILED');

    expect(terminalState?.attempts).toBe(3);

    expect(terminalState?.failedAt).not.toBeNull();

    const deliveryCount = await prisma.notificationDelivery.count({
      where: {
        notificationId: fixture.notificationId,
      },
    });

    expect(deliveryCount).toBe(1);

    const delivery = await prisma.notificationDelivery.findFirst({
      where: {
        notificationId: fixture.notificationId,
      },
    });

    expect(delivery).not.toBeNull();

    expect(delivery?.status).toBe('FAILED');

    expect(delivery?.attempts).toBe(3);

    expect(delivery?.failedAt).not.toBeNull();
  });

  it('uses the provider failure classification at the production provider boundary', async () => {
    const failureSimulator = new NotificationProviderFailureSimulator({
      mode: 'permanent',

      retryAfterMs: 1_000,

      errorCode: 'PHASE_4_13_E_PERMANENT_FAILURE',

      errorMessage: 'Phase 4.13-E permanent provider rejection.',
    });

    const emailProvider = {
      channel: 'email' as const,

      send: vi.fn(),
    };

    const inAppProvider = {
      channel: 'in-app' as const,

      send: vi.fn(),
    };

    const pushProvider = {
      channel: 'push' as const,

      send: vi.fn(),
    };

    const registry = new NotificationProviderRegistry(
      emailProvider as never,

      inAppProvider as never,

      pushProvider as never,

      failureSimulator,
    );

    const provider = registry.get('email');

    const notificationId = `${prefix}-classification`;

    const result = await provider.send(
      {
        notificationId,

        channel: 'email',

        recipient: {
          userId: `${notificationId}-user`,

          email: `${notificationId}@gurusthalam.local`,
        },

        body: 'Provider classification acceptance test.',

        idempotencyKey: `${notificationId}-idempotency`,
      },

      {
        deliveryKey: `${notificationId}-delivery`,
      },
    );

    expect(result).toEqual({
      accepted: false,

      provider: 'development-email',

      channel: 'email',

      notificationId,

      classification: NotificationFailureClassification.PERMANENT,

      errorCode: 'PHASE_4_13_E_PERMANENT_FAILURE',

      errorMessage: 'Phase 4.13-E permanent provider rejection.',
    });

    expect(emailProvider.send).not.toHaveBeenCalled();
  });
});
