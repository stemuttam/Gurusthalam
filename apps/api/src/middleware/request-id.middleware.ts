import { randomUUID } from 'node:crypto';

import {
  Injectable,
  type NestMiddleware,
} from '@nestjs/common';

import type {
  NextFunction,
  Request,
  Response,
} from 'express';

@Injectable()
export class RequestIdMiddleware
  implements NestMiddleware
{
  use(
    request: Request,
    response: Response,
    next: NextFunction,
  ): void {
    const incomingRequestId =
      request.get('x-request-id')?.trim();

    const requestId =
      incomingRequestId &&
      /^[A-Za-z0-9._-]{1,128}$/.test(
        incomingRequestId,
      )
        ? incomingRequestId
        : randomUUID();

    response.setHeader(
      'x-request-id',
      requestId,
    );

    response.locals.requestId = requestId;

    next();
  }
}