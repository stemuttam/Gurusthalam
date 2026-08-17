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

import {
  NotificationDeliveryPersistenceService,
} from './notifications/notification-delivery-persistence.service.js';

import {
  NotificationIdempotencyService,
} from './providers/notification/notification-idempotency.service.js';

import {
  OutboxDispatcher,
} from './outbox/outbox.dispatcher.js';

export class GurusthalamWorker {
  private readonly workers:
    Worker[] = [];

  private readonly logger:
    GurusthalamLogger;

  private readonly prisma:
    PrismaClient;

  private readonly notificationPersistence:
    NotificationPersistenceService;

  private readonly notificationDeliveryPersistence:
    NotificationDeliveryPersistenceService;

  private readonly notificationIdempotency:
    NotificationIdempotencyService;

  private readonly outboxDispatcher:
    OutboxDispatcher;

  private started =
    false;

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

    this.notificationDeliveryPersistence =
      new NotificationDeliveryPersistenceService(
        this.prisma,
      );

    this.notificationIdempotency =
      new NotificationIdempotencyService();

    this.outboxDispatcher =
      new OutboxDispatcher(
        this.prisma,
        this.logger,
      );
  }

  async start(): Promise<void> {
    if (this.started) {
      this.logger.info(
        'Gurusthalam worker is already started',
        {
          operation:
            'worker.start.skip',
        },
      );

      return;
    }

    try {
      /*
       * -------------------------------------------------------
       * PostgreSQL
       * -------------------------------------------------------
       */
      await this.prisma.$connect();

      this.logger.info(
        'PostgreSQL connection established',
        {
          operation:
            'database.connected',

          service:
            'database',
        },
      );

      /*
       * -------------------------------------------------------
       * Redis / BullMQ
       * -------------------------------------------------------
       */
      const redis =
        getRedisConfig();

      const connection:
        WorkerOptions['connection'] =
        {
          url:
            redis.url,

          maxRetriesPerRequest:
            null,
        };

      /*
       * -------------------------------------------------------
       * System worker
       * -------------------------------------------------------
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
            job:
              Job<SystemJobData>,
          ): Promise<SystemJobResult> =>
            systemProcessor.process(
              job,
            ),

          {
            connection,

            prefix:
              QUEUE_PREFIX,

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
              job.id ??
              'unknown'
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
        (
          job,
          error,
        ) => {
          this.logger.error(
            `Job failed: ${
              job?.id ??
              'unknown'
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
       * -------------------------------------------------------
       * Notification providers
       * -------------------------------------------------------
       */
      const emailProvider =
        new EmailNotificationProvider(
          this.logger,

          this.notificationIdempotency,
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
       * -------------------------------------------------------
       * Notification processor
       * -------------------------------------------------------
       */
      const notificationProcessor =
        new NotificationProcessor(
          this.logger,

          providerRegistry,

          this.notificationPersistence,

          this.notificationDeliveryPersistence,
        );

      /*
       * -------------------------------------------------------
       * Notification worker
       * -------------------------------------------------------
       */
      const notificationWorker =
        new Worker<
          NotificationJobData,
          NotificationJobResult
        >(
          QUEUE_NAMES.NOTIFICATIONS,

          async (
            job:
              Job<NotificationJobData>,
          ): Promise<NotificationJobResult> =>
            notificationProcessor.process(
              job,
            ),

          {
            connection,

            prefix:
              QUEUE_PREFIX,

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
              job.id ??
              'unknown'
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
        (
          job,
          error,
        ) => {
          this.logger.error(
            `Notification job failed: ${
              job?.id ??
              'unknown'
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

      /*
       * -------------------------------------------------------
       * Wait for BullMQ workers
       * -------------------------------------------------------
       */
      await Promise.all(
        this.workers.map(
          (
            worker,
          ) =>
            worker.waitUntilReady(),
        ),
      );

      /*
       * -------------------------------------------------------
       * Start outbox dispatcher
       * -------------------------------------------------------
       */
      this.outboxDispatcher.start();

      this.started =
        true;

      this.logger.info(
        `Gurusthalam worker started with ${this.workers.length} worker(s) and outbox dispatcher`,
        {
          operation:
            'worker.start',
        },
      );
    } catch (error: unknown) {
      this.logger.error(
        'Worker bootstrap failed',
        error,
        {
          operation:
            'bootstrap',
        },
      );

      await this.shutdownResources();

      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.started) {
      await this.shutdownResources();

      return;
    }

    this.logger.info(
      `Stopping ${this.workers.length} worker(s) and outbox dispatcher`,
      {
        operation:
          'worker.stop',
      },
    );

    await this.shutdownResources();

    this.started =
      false;

    this.logger.info(
      'Gurusthalam worker stopped',
      {
        operation:
          'worker.stopped',
      },
    );
  }

  private async shutdownResources(): Promise<void> {
    /*
     * -------------------------------------------------------
     * Stop outbox dispatcher first
     * -------------------------------------------------------
     */
    try {
      await this.outboxDispatcher.stop();
    } catch (error: unknown) {
      this.logger.error(
        'Failed to stop outbox dispatcher',
        error,
        {
          operation:
            'outbox.stop.error',

          service:
            'outbox',
        },
      );
    }

    /*
     * -------------------------------------------------------
     * Close BullMQ workers
     * -------------------------------------------------------
     */
    if (
      this.workers.length >
      0
    ) {
      try {
        await Promise.all(
          this.workers.map(
            async (
              worker,
            ) => {
              await worker.close();
            },
          ),
        );
      } catch (error: unknown) {
        this.logger.error(
          'Failed to close BullMQ workers',
          error,
          {
            operation:
              'worker.close.error',
          },
        );
      }

      this.workers.length =
        0;
    }

    /*
     * -------------------------------------------------------
     * Close provider idempotency Redis connection
     * -------------------------------------------------------
     */
    try {
      await this.notificationIdempotency.close();

      this.logger.info(
        'Notification idempotency Redis connection closed',
        {
          operation:
            'notification.idempotency.redis.closed',

          service:
            'notification-idempotency',
        },
      );
    } catch (error: unknown) {
      this.logger.error(
        'Failed to close notification idempotency Redis connection',
        error,
        {
          operation:
            'notification.idempotency.redis.close.error',

          service:
            'notification-idempotency',
        },
      );
    }

    /*
     * -------------------------------------------------------
     * Disconnect PostgreSQL
     * -------------------------------------------------------
     */
    try {
      await this.prisma.$disconnect();

      this.logger.info(
        'PostgreSQL connection closed',
        {
          operation:
            'database.disconnected',

          service:
            'database',
        },
      );
    } catch (error: unknown) {
      this.logger.error(
        'Failed to disconnect PostgreSQL',
        error,
        {
          operation:
            'database.disconnect.error',

          service:
            'database',
        },
      );
    }
  }
}