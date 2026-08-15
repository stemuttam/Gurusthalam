import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

import type {
  Request,
  Response,
} from 'express';

import type {
  GurusthalamLogger,
} from '@gurusthalam/logger';

interface HttpErrorResponse {
  readonly statusCode: number;
  readonly timestamp: string;
  readonly path: string;
  readonly requestId?: string;
  readonly message: unknown;
}

@Catch()
export class GlobalExceptionFilter
  implements ExceptionFilter
{
  constructor(
    private readonly logger: GurusthalamLogger,
  ) {}

  catch(
    exception: unknown,
    host: ArgumentsHost,
  ): void {
    const context = host.switchToHttp();

    const request =
      context.getRequest<Request>();

    const response =
      context.getResponse<Response>();

    const requestId =
      response.locals.requestId;

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : undefined;

    let message: unknown =
      'Internal server error';

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (
      exceptionResponse !== null &&
      typeof exceptionResponse === 'object' &&
      'message' in exceptionResponse
    ) {
      message = (
        exceptionResponse as {
          readonly message?: unknown;
        }
      ).message;
    }

    this.logger.error(
      'Unhandled HTTP exception',
      exception,
      {
        requestId,
        operation: `${
          request.method
        } ${
          request.originalUrl ??
          request.url
        }`,
      },
    );

    const errorResponse: HttpErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path:
        request.originalUrl ??
        request.url,
      ...(requestId
        ? { requestId }
        : {}),
      message,
    };

    response
      .status(status)
      .json(errorResponse);
  }
}