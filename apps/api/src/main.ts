import { NestFactory } from '@nestjs/core';

import {
  GurusthalamLogger,
} from '@gurusthalam/logger';

import { AppModule } from './app/app.module.js';
import { AppConfigService } from './config/app-config.service.js';
import { GlobalExceptionFilter } from './filters/global-exception.filter.js';
import { NestLoggerAdapter } from './common/logger/nest-logger.adapter.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: false,
  });

  const config = app.get(AppConfigService);

  const structuredLogger = new GurusthalamLogger({
    service: config.name,
    environment: config.environment,
  });

  const nestLogger = new NestLoggerAdapter(
    structuredLogger,
  );

  app.useLogger(nestLogger);

  app.setGlobalPrefix(config.apiPrefix);

  app.useGlobalFilters(
    new GlobalExceptionFilter(structuredLogger),
  );

  app.enableShutdownHooks();

  await app.listen(config.port);

  structuredLogger.info(
    `🚀 ${config.name} started successfully`,
    {
      operation: 'bootstrap',
      service: config.name,
    },
  );

  structuredLogger.info(
    `HTTP server listening on port ${config.port}`,
    {
      operation: 'bootstrap',
    },
  );
}

void bootstrap().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  const fallbackLogger = new GurusthalamLogger({
    service: 'api-bootstrap',
    environment:
      process.env.NODE_ENV ?? 'development',
  });

  fallbackLogger.error(
    `API bootstrap failed: ${message}`,
    error,
    {
      operation: 'bootstrap',
    },
  );

  process.exitCode = 1;
});