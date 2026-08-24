import {
  Controller,
  Get,
  ParseFloatPipe,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  InternalApiKeyGuard,
} from '../../security/internal-api-key.guard.js';

import {
  NotificationReconciliationService,
} from './notification-reconciliation.service.js';

@Controller(
  'internal/notification-reconciliation',
)
@UseGuards(
  InternalApiKeyGuard,
)
export class NotificationReconciliationController {
  constructor(
    private readonly reconciliation:
      NotificationReconciliationService,
  ) {}

  @Get()
  async audit(
    @Query(
      'staleAfterSeconds',
      new ParseFloatPipe({
        optional:
          true,
      }),
    )
    staleAfterSeconds?:
      number,

    @Query(
      'limit',
      new ParseIntPipe({
        optional:
          true,
      }),
    )
    limit?:
      number,
  ) {
    return this.reconciliation.audit({
      ...(staleAfterSeconds !==
      undefined
        ? {
            staleAfterSeconds,
          }
        : {}),

      ...(limit !==
      undefined
        ? {
            limit,
          }
        : {}),
    });
  }

  @Post(
    'recover-stale',
  )
  async recoverStale(
    @Query(
      'staleAfterSeconds',
      new ParseFloatPipe({
        optional:
          true,
      }),
    )
    staleAfterSeconds?:
      number,

    @Query(
      'limit',
      new ParseIntPipe({
        optional:
          true,
      }),
    )
    limit?:
      number,
  ) {
    return this.reconciliation.recoverStaleProcessing({
      ...(staleAfterSeconds !==
      undefined
        ? {
            staleAfterSeconds,
          }
        : {}),

      ...(limit !==
      undefined
        ? {
            limit,
          }
        : {}),
    });
  }
}