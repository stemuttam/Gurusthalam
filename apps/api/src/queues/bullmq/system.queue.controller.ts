import {
  Body,
  Controller,
  Post,
} from '@nestjs/common';

import {
  SystemQueueService,
  type SystemSmokeJobData,
} from './system.queue.js';

interface EnqueueSystemSmokeRequest {
  readonly message?: unknown;
}

@Controller('internal/queues')
export class SystemQueueController {
  constructor(
    private readonly systemQueue: SystemQueueService,
  ) {}

  @Post('system-smoke')
  async enqueue(
    @Body() body: EnqueueSystemSmokeRequest,
  ) {
    const message =
      typeof body.message === 'string' &&
      body.message.trim().length > 0
        ? body.message.trim()
        : 'Gurusthalam BullMQ smoke test';

    const data: SystemSmokeJobData = {
      message,
    };

    return this.systemQueue.enqueue(data);
  }
}