import type {
  GurusthalamLogger,
} from '@gurusthalam/logger';

export class NestLoggerAdapter {
  constructor(
    private readonly logger: GurusthalamLogger,
  ) {}

  log(
    message: string,
    context?: string,
  ): void {
    this.logger.info(
      message,
      context
        ? { operation: context }
        : undefined,
    );
  }

  error(
    message: string,
    stack?: string,
    context?: string,
  ): void {
    const error = stack
      ? Object.assign(
          new Error(message),
          { stack },
        )
      : undefined;

    this.logger.error(
      message,
      error,
      context
        ? { operation: context }
        : undefined,
    );
  }

  warn(
    message: string,
    context?: string,
  ): void {
    this.logger.warn(
      message,
      context
        ? { operation: context }
        : undefined,
    );
  }

  debug(
    message: string,
    context?: string,
  ): void {
    this.logger.debug(
      message,
      context
        ? { operation: context }
        : undefined,
    );
  }

  verbose(
    message: string,
    context?: string,
  ): void {
    this.logger.debug(
      message,
      context
        ? { operation: context }
        : undefined,
    );
  }

  fatal(
    message: string,
    context?: string,
  ): void {
    this.logger.error(
      message,
      undefined,
      context
        ? { operation: context }
        : undefined,
    );
  }
}