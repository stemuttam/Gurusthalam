import {
  GurusthalamLogger,
} from '@gurusthalam/logger';

import {
  getEnvironment,
} from '@gurusthalam/config';

import {
  GurusthalamWorker,
} from './worker.js';

async function bootstrap(): Promise<void> {
  const environment =
    getEnvironment();

  const logger =
    new GurusthalamLogger({
      service: 'gurusthalam-worker',
      environment,
    });

  const worker =
    new GurusthalamWorker();

  const shutdown =
    async (
      signal: string,
    ): Promise<void> => {
      logger.info(
        `Received ${signal}; shutting down worker`,
        {
          operation: 'shutdown',
        },
      );

      await worker.stop();

      process.exitCode = 0;
    };

  process.once(
    'SIGINT',
    () => {
      void shutdown('SIGINT');
    },
  );

  process.once(
    'SIGTERM',
    () => {
      void shutdown('SIGTERM');
    },
  );

  await worker.start();
}

void bootstrap().catch(
  (error: unknown) => {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    const logger =
      new GurusthalamLogger({
        service: 'gurusthalam-worker',
        environment:
          process.env.NODE_ENV ??
          'development',
      });

    logger.error(
      `Worker bootstrap failed: ${message}`,
      error,
      {
        operation: 'bootstrap',
      },
    );

    process.exitCode = 1;
  },
);