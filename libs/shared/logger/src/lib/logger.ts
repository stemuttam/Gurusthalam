import winston from 'winston';

import type {
  LoggerContext,
  LoggerOptions,
} from './logger.types.js';

import {
  serializeContext,
} from './logger.utils.js';

export class GurusthalamLogger {
  private readonly logger: winston.Logger;

  constructor(options: LoggerOptions) {
    this.logger = winston.createLogger({
      level:
        options.environment === 'production'
          ? 'info'
          : 'debug',

      defaultMeta: {
        service: options.service,
        environment: options.environment,
      },

      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({
          stack: true,
        }),
        winston.format.json(),
      ),

      transports: [
        new winston.transports.Console(),
      ],
    });
  }

  debug(
    message: string,
    context?: LoggerContext,
  ): void {
    this.logger.debug(
      message,
      serializeContext(context),
    );
  }

  info(
    message: string,
    context?: LoggerContext,
  ): void {
    this.logger.info(
      message,
      serializeContext(context),
    );
  }

  warn(
    message: string,
    context?: LoggerContext,
  ): void {
    this.logger.warn(
      message,
      serializeContext(context),
    );
  }

  error(
    message: string,
    error?: unknown,
    context?: LoggerContext,
  ): void {
    const metadata: Record<string, unknown> = {
      ...serializeContext(context),
    };

    if (error instanceof Error) {
      metadata.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    } else if (error !== undefined) {
      metadata.error = error;
    }

    this.logger.error(message, metadata);
  }
}