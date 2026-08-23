import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import {
  timingSafeEqual,
} from 'node:crypto';

import type {
  Request,
} from 'express';

@Injectable()
export class InternalApiKeyGuard
  implements CanActivate {
  canActivate(
    context:
      ExecutionContext,
  ): boolean {
    const request =
      context
        .switchToHttp()
        .getRequest<Request>();

    const configuredKey =
      process.env.INTERNAL_API_KEY;

    /*
     * Fail closed.
     *
     * An internal endpoint must never become publicly accessible
     * simply because its authentication secret was omitted.
     */
    if (
      !configuredKey ||
      configuredKey.length ===
        0
    ) {
      throw new UnauthorizedException(
        'Internal API authentication is not configured.',
      );
    }

    const suppliedKey =
      request.header(
        'x-internal-api-key',
      );

    if (
      !suppliedKey ||
      suppliedKey.length ===
        0
    ) {
      throw new UnauthorizedException(
        'Internal API key is required.',
      );
    }

    const configuredBuffer =
      Buffer.from(
        configuredKey,
        'utf8',
      );

    const suppliedBuffer =
      Buffer.from(
        suppliedKey,
        'utf8',
      );

    /*
     * timingSafeEqual requires equal-length buffers.
     */
    if (
      configuredBuffer.length !==
      suppliedBuffer.length
    ) {
      throw new UnauthorizedException(
        'Invalid internal API key.',
      );
    }

    if (
      !timingSafeEqual(
        configuredBuffer,
        suppliedBuffer,
      )
    ) {
      throw new UnauthorizedException(
        'Invalid internal API key.',
      );
    }

    return true;
  }
}