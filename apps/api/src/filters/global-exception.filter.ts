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

import {
  EnrollmentCompletionApplicationError,
  EnrollmentCompletionErrorCode,
} from '@gurusthalam/learning';

import type { GurusthalamLogger } from '@gurusthalam/logger';

import {
  PrismaRepositoryError,
  PrismaRepositoryErrorCode,
} from '../database/prisma/repositories/prisma-repository.error.js';

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

interface StructuredErrorDetails {
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
    const details = this.resolveStructuredErrorDetails(exception);

    const operation = `${request.method} ${request.originalUrl ?? request.url}`;

    this.logException(exception, status, requestId, operation);

    const errorResponse: HttpErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.originalUrl ?? request.url,
      ...(requestId ? { requestId } : {}),
      message,
      ...(details.code ? { code: details.code } : {}),
      ...(details.issues ? { issues: details.issues } : {}),
      ...(details.transition ? { transition: details.transition } : {}),
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

    if (exception instanceof EnrollmentCompletionApplicationError) {
      switch (exception.code) {
        case EnrollmentCompletionErrorCode.VALIDATION:
          return HttpStatus.BAD_REQUEST;

        case EnrollmentCompletionErrorCode.ENROLLMENT_NOT_FOUND:
        case EnrollmentCompletionErrorCode.COURSE_STRUCTURE_NOT_FOUND:
          return HttpStatus.NOT_FOUND;

        case EnrollmentCompletionErrorCode.ENROLLMENT_NOT_ACTIVE:
        case EnrollmentCompletionErrorCode.COURSE_HAS_NO_LEARNING_UNITS:
        case EnrollmentCompletionErrorCode.LEARNING_UNITS_INCOMPLETE:
          return HttpStatus.CONFLICT;
      }
    }

    if (exception instanceof PrismaRepositoryError) {
      if (
        exception.code === PrismaRepositoryErrorCode.CONCURRENT_MODIFICATION
      ) {
        return HttpStatus.CONFLICT;
      }

      // Other repository failures are infrastructure failures.
      // Do not infer that an API resource is missing merely because
      // an internal persistence operation reported a missing record.
      return HttpStatus.INTERNAL_SERVER_ERROR;
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private resolveMessage(
    exception: unknown,
    exceptionResponse: unknown,
  ): unknown {
    if (
      exception instanceof CourseValidationError ||
      exception instanceof InvalidCourseStateTransitionError ||
      exception instanceof EnrollmentCompletionApplicationError
    ) {
      return exception.message;
    }

    if (exception instanceof PrismaRepositoryError) {
      if (
        exception.code === PrismaRepositoryErrorCode.CONCURRENT_MODIFICATION
      ) {
        return 'The resource was modified by another operation. Refresh and try again.';
      }

      return 'An internal persistence error occurred.';
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

  private resolveStructuredErrorDetails(
    exception: unknown,
  ): StructuredErrorDetails {
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

    if (exception instanceof EnrollmentCompletionApplicationError) {
      return {
        code: exception.code,
        ...(exception.issues.length > 0 ? { issues: exception.issues } : {}),
      };
    }

    if (exception instanceof PrismaRepositoryError) {
      // Expose only the stable repository error code, never the
      // underlying Prisma code, SQL details, or original cause.
      return {
        code: exception.code,
      };
    }

    return {};
  }

  private logException(
    exception: unknown,
    status: number,
    requestId: string | undefined,
    operation: string,
  ): void {
    const context = {
      ...(requestId ? { requestId } : {}),
      operation,
      statusCode: status,
    };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error('Unhandled HTTP exception', exception, context);
      return;
    }

    // Expected client errors are warning-level events.
    // Keep context compatible with the shared LoggerContext contract.
    this.logger.warn('HTTP request rejected', context);
  }
}
