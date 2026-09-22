import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

import type { Request, Response } from 'express';

import {
  CourseValidationError,
  InvalidCourseStateTransitionError,
} from '@gurusthalam/courses';

import type { GurusthalamLogger } from '@gurusthalam/logger';

interface HttpErrorResponse {
  readonly statusCode: number;
  readonly timestamp: string;
  readonly path: string;
  readonly requestId?: string;
  readonly message: unknown;
  readonly code?: string;
  readonly issues?: readonly {
    readonly field: string;
    readonly message: string;
  }[];
  readonly transition?: {
    readonly from: string;
    readonly to: string;
  };
}

interface CourseErrorDetails {
  readonly code?: string;
  readonly issues?: readonly {
    readonly field: string;
    readonly message: string;
  }[];
  readonly transition?: {
    readonly from: string;
    readonly to: string;
  };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: GurusthalamLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();

    const request = context.getRequest<Request>();

    const response = context.getResponse<Response>();

    const requestId = response.locals.requestId;

    const status = this.resolveStatus(exception);

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;

    const message = this.resolveMessage(exception, exceptionResponse);

    const courseErrorDetails = this.resolveCourseErrorDetails(exception);

    this.logger.error('Unhandled HTTP exception', exception, {
      requestId,
      operation: `${request.method} ${request.originalUrl ?? request.url}`,
    });

    const errorResponse: HttpErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.originalUrl ?? request.url,
      ...(requestId ? { requestId } : {}),
      message,
      ...(courseErrorDetails.code ? { code: courseErrorDetails.code } : {}),
      ...(courseErrorDetails.issues
        ? { issues: courseErrorDetails.issues }
        : {}),
      ...(courseErrorDetails.transition
        ? { transition: courseErrorDetails.transition }
        : {}),
    };

    response.status(status).json(errorResponse);
  }

  private resolveStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    if (exception instanceof CourseValidationError) {
      return HttpStatus.BAD_REQUEST;
    }

    if (exception instanceof InvalidCourseStateTransitionError) {
      return HttpStatus.CONFLICT;
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private resolveMessage(
    exception: unknown,
    exceptionResponse: unknown,
  ): unknown {
    if (
      exception instanceof CourseValidationError ||
      exception instanceof InvalidCourseStateTransitionError
    ) {
      return exception.message;
    }

    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    if (
      exceptionResponse !== null &&
      typeof exceptionResponse === 'object' &&
      'message' in exceptionResponse
    ) {
      return (
        exceptionResponse as {
          readonly message?: unknown;
        }
      ).message;
    }

    return 'Internal server error';
  }

  private resolveCourseErrorDetails(exception: unknown): CourseErrorDetails {
    if (exception instanceof CourseValidationError) {
      return {
        code: exception.code,
        issues: exception.issues,
      };
    }

    if (exception instanceof InvalidCourseStateTransitionError) {
      return {
        code: exception.code,
        transition: {
          from: exception.from,
          to: exception.to,
        },
      };
    }

    return {};
  }
}
