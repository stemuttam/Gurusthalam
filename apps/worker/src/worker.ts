import {
  Worker,
  type Job,
  type WorkerOptions,
} from 'bullmq';

import {
  createPrismaClient,
  type PrismaClient,
} from '@gurusthalam/database';

import {
  getRedisConfig,
} from '@gurusthalam/config';

import {
  GurusthalamLogger,
} from '@gurusthalam/logger';

import {
  QUEUE_NAMES,
  QUEUE_PREFIX,
} from './queues/queue.constants.js';

import {
  WORKER_OPTIONS,
} from './queues/queue.policy.js';

import {
  SystemProcessor,
  type SystemJobData,
  type SystemJobResult,
} from './processors/system.processor.js';

import {
  NotificationProcessor,
  type NotificationJobData,
  type NotificationJobResult,
} from './processors/notification.processor.js';

import {
  EmailNotificationProvider,
} from './providers/notification/email-notification.provider.js';

import {
  InAppNotificationProvider,
} from './providers/notification/in-app-notification.provider.js';

import {
  PushNotificationProvider,
} from './providers/notification/push-notification.provider.js';

import {
  NotificationProviderRegistry,
} from './providers/notification/notification-provider.registry.js';

import {
  NotificationPersistenceService,
} from './notifications/notification-persistence.service.js';

export class GurusthalamWorker {
  private readonly workers: Worker[] = [];

  private readonly logger:
    GurusthalamLogger;

  private readonly prisma:
    PrismaClient;

  private readonly notificationPersistence:
    NotificationPersistenceService;

  constructor() {
    this.logger =
      new GurusthalamLogger({
        service:
          'gurusthalam-worker',
        environment:
          process.env.NODE_ENV ??
          'development',
      });

    this.prisma =
      createPrismaClient();

    this.notificationPersistence =
      new NotificationPersistenceService(
        this.prisma,
      );
  }

  async start(): Promise<void> {
    await this.prisma.$connect();

    const redis =
      getRedisConfig();

    const connection:
      WorkerOptions['connection'] = {
      url: redis.url,
      maxRetriesPerRequest:
        null,
    };

    /*
     * ---------------------------------------------------------
     * System worker
     * ---------------------------------------------------------
     */

    const systemProcessor =
      new SystemProcessor(
        this.logger,
      );

    const systemWorker =
      new Worker<
        SystemJobData,
        SystemJobResult
      >(
        QUEUE_NAMES.SYSTEM,
        async (
          job: Job<SystemJobData>,
        ): Promise<SystemJobResult> =>
          systemProcessor.process(
            job,
          ),
        {
          connection,
          prefix: QUEUE_PREFIX,
          ...WORKER_OPTIONS,
        },
      );

    systemWorker.on(
      'ready',
      () => {
        this.logger.info(
          `Worker ready: ${QUEUE_NAMES.SYSTEM}`,
          {
            operation:
              'worker.ready',
            service:
              QUEUE_NAMES.SYSTEM,
          },
        );
      },
    );

    systemWorker.on(
      'completed',
      (job) => {
        this.logger.info(
          `Job completed: ${
            job.id ?? 'unknown'
          }`,
          {
            operation:
              'worker.completed',
            service:
              QUEUE_NAMES.SYSTEM,
          },
        );
      },
    );

    systemWorker.on(
      'failed',
      (job, error) => {
        this.logger.error(
          `Job failed: ${
            job?.id ?? 'unknown'
          }`,
          error,
          {
            operation:
              'worker.failed',
            service:
              QUEUE_NAMES.SYSTEM,
          },
        );
      },
    );

    systemWorker.on(
      'error',
      (error) => {
        this.logger.error(
          'BullMQ worker error',
          error,
          {
            operation:
              'worker.error',
            service:
              QUEUE_NAMES.SYSTEM,
          },
        );
      },
    );

    this.workers.push(
      systemWorker,
    );

    /*
     * ---------------------------------------------------------
     * Notification providers
     * ---------------------------------------------------------
     */

    const emailProvider =
      new EmailNotificationProvider(
        this.logger,
      );

    const inAppProvider =
      new InAppNotificationProvider(
        this.logger,
      );

    const pushProvider =
      new PushNotificationProvider(
        this.logger,
      );

    const providerRegistry =
      new NotificationProviderRegistry(
        emailProvider,
        inAppProvider,
        pushProvider,
      );

    /*
     * ---------------------------------------------------------
     * Notification processor
     * ---------------------------------------------------------
     */

    const notificationProcessor =
      new NotificationProcessor(
        this.logger,
        providerRegistry,
        this.notificationPersistence,
      );

    /*
     * ---------------------------------------------------------
     * Notification worker
     * ---------------------------------------------------------
     */

    const notificationWorker =
      new Worker<
        NotificationJobData,
        NotificationJobResult
      >(
        QUEUE_NAMES.NOTIFICATIONS,
        async (
          job: Job<NotificationJobData>,
        ): Promise<NotificationJobResult> =>
          notificationProcessor.process(
            job,
          ),
        {
          connection,
          prefix: QUEUE_PREFIX,
          ...WORKER_OPTIONS,
        },
      );

    notificationWorker.on(
      'ready',
      () => {
        this.logger.info(
          `Worker ready: ${QUEUE_NAMES.NOTIFICATIONS}`,
          {
            operation:
              'worker.ready',
            service:
              QUEUE_NAMES.NOTIFICATIONS,
          },
        );
      },
    );

    notificationWorker.on(
      'completed',
      (job) => {
        this.logger.info(
          `Notification job completed: ${
            job.id ?? 'unknown'
          }`,
          {
            operation:
              'worker.completed',
            service:
              QUEUE_NAMES.NOTIFICATIONS,
          },
        );
      },
    );

    notificationWorker.on(
      'failed',
      (job, error) => {
        this.logger.error(
          `Notification job failed: ${
            job?.id ?? 'unknown'
          }`,
          error,
          {
            operation:
              'worker.failed',
            service:
              QUEUE_NAMES.NOTIFICATIONS,
          },
        );
      },
    );

    notificationWorker.on(
      'error',
      (error) => {
        this.logger.error(
          'Notification worker error',
          error,
          {
            operation:
              'worker.error',
            service:
              QUEUE_NAMES.NOTIFICATIONS,
          },
        );
      },
    );

    this.workers.push(
      notificationWorker,
    );

    await Promise.all(
      this.workers.map(
        (worker) =>
          worker.waitUntilReady(),
      ),
    );

    this.logger.info(
      `Gurusthalam worker started with ${this.workers.length} worker(s)`,
      {
        operation:
          'worker.start',
      },
    );
  }

  async stop(): Promise<void> {
    if (
      this.workers.length === 0
    ) {
      await this.prisma.$disconnect();
      return;
    }

    this.logger.info(
      `Stopping ${this.workers.length} worker(s)`,
      {
        operation:
          'worker.stop',
      },
    );

    await Promise.all(
      this.workers.map(
        async (worker) => {
          await worker.close();
        },
      ),
    );

    this.workers.length = 0;

    await this.prisma.$disconnect();

    this.logger.info(
      'Gurusthalam worker stopped',
      {
        operation:
          'worker.stopped',
      },
    );
  }
}