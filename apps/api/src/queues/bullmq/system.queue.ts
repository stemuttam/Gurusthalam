import { Injectable } from '@nestjs/common';

import {
  BullMqService,
} from './bullmq.service.js';

import {
  BULLMQ_QUEUE_NAMES,
} from './bullmq.constants.js';

import {
  SYSTEM_JOB_OPTIONS,
} from './bullmq.policy.js';

export interface SystemSmokeJobData {
  readonly message: string;
}

@Injectable()
export class SystemQueueService {
  constructor(
    private readonly bullMq: BullMqService,
  ) {}

  async enqueue(
    data: SystemSmokeJobData,
  ): Promise<{
    readonly jobId: string | undefined;
    readonly queue: string;
  }> {
    const queue =
      this.bullMq.getQueue(
        BULLMQ_QUEUE_NAMES.SYSTEM,
      );

    const job = await queue.add(
      'system-smoke',
      data,
      SYSTEM_JOB_OPTIONS,
    );

    return {
      jobId: job.id,
      queue: BULLMQ_QUEUE_NAMES.SYSTEM,
    };
  }
}