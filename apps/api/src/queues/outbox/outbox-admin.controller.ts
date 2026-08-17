import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';

import {
  OutboxAdminService,
  type OutboxRecord,
  type OutboxSummary,
  type StuckRecoveryResult,
} from './outbox-admin.service.js';

@Controller('internal/outbox')
export class OutboxAdminController {
  constructor(
    private readonly outbox:
      OutboxAdminService,
  ) {}

  @Get('summary')
  async summary(): Promise<OutboxSummary> {
    return this.outbox.getSummary();
  }

  @Get('dead-letters')
  async deadLetters(
    @Query(
      'limit',
      new ParseIntPipe({
        optional: true,
      }),
    )
    limit?: number,
  ): Promise<OutboxRecord[]> {
    return this.outbox.getDeadLetters(
      limit,
    );
  }

  @Get(':id')
  async getEvent(
    @Param('id')
    id: string,
  ): Promise<OutboxRecord> {
    return this.outbox.getEvent(
      id,
    );
  }

  @Post(':id/requeue')
  async requeue(
    @Param('id')
    id: string,
  ): Promise<OutboxRecord> {
    return this.outbox.requeueDeadLetter(
      id,
    );
  }

  @Post('recover-stuck')
  async recoverStuck(): Promise<StuckRecoveryResult> {
    return this.outbox.recoverStuckEvents();
  }
}