import type { Job } from 'bullmq';

import {
  GurusthalamLogger,
} from '@gurusthalam/logger';

export interface SystemJobData {
  readonly message: string;
}

export interface SystemJobResult {
  readonly processed: true;
  readonly message: string;
}

export class SystemProcessor {
  constructor(
    private readonly logger: GurusthalamLogger,
  ) {}

  async process(
    job: Job<SystemJobData>,
  ): Promise<SystemJobResult> {
    this.logger.info(
      `Processing system job: ${job.id ?? 'unknown'}`,
      {
        operation: 'system-job.process',
      },
    );

    this.logger.info(
      job.data.message,
      {
        operation: 'system-job.message',
      },
    );

    return {
      processed: true,
      message: job.data.message,
    };
  }
}