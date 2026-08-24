import {
  GurusthalamLogger,
} from '@gurusthalam/logger';

import {
  getEnvironment,
} from '@gurusthalam/config';

import {
  GurusthalamWorker,
} from './worker.js';

import {
  OutboxDeadLetterSyncService,
} from './outbox/outbox-dead-letter-sync.service.js';

async function bootstrap(): Promise<void> {
  const environment =
    getEnvironment();

  const logger =
    new GurusthalamLogger({
      service:
        'gurusthalam-worker',

      environment,
    });

  const worker =
    new GurusthalamWorker();

  const deadLetterSync =
    new OutboxDeadLetterSyncService(
      logger,
    );

  const shutdown =
    async (
      signal: string,
    ): Promise<void> => {
      logger.info(
        `Received ${signal}; shutting down worker`,
        {
          operation:
            'shutdown',
        },
      );

      /*
       * Stop the synchronization loop before shutting down
       * the main worker resources.
       */
      try {
        await deadLetterSync.stop();
      } catch (
        error: unknown
      ) {
        logger.error(
          'Failed to stop outbox dead-letter synchronization',
          error,
          {
            operation:
              'outbox.dead_letter_sync.stop.error',
          },
        );
      }

      await worker.stop();

      process.exitCode =
        0;
    };

  process.once(
    'SIGINT',
    () => {
      void shutdown(
        'SIGINT',
      );
    },
  );

  process.once(
    'SIGTERM',
    () => {
      void shutdown(
        'SIGTERM',
      );
    },
  );

  await worker.start();

  await deadLetterSync.start();
}

void bootstrap().catch(
  (
    error: unknown,
  ) => {
    const message =
      error instanceof Error
        ? error.message
        : String(
            error,
          );

    const logger =
      new GurusthalamLogger({
        service:
          'gurusthalam-worker',

        environment:
          process.env.NODE_ENV ??
          'development',
      });

    logger.error(
      `Worker bootstrap failed: ${message}`,
      error,
      {
        operation:
          'bootstrap',
      },
    );

    process.exitCode =
      1;
  },
);