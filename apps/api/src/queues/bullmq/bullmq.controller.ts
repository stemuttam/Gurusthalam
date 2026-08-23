import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';

import {
  InternalApiKeyGuard,
} from '../../security/internal-api-key.guard.js';

import {
  BULLMQ_QUEUE_NAMES,
} from './bullmq.constants.js';

import {
  BullMqService,
} from './bullmq.service.js';

@Controller(
  'internal/queues',
)
@UseGuards(
  InternalApiKeyGuard,
)
export class BullMqController {
  constructor(
    private readonly bullMq:
      BullMqService,
  ) {}

  @Get(
    'system-smoke',
  )
  async getSystemSmokeQueue() {
    return this.bullMq.getQueueCounts(
      BULLMQ_QUEUE_NAMES.SYSTEM,
    );
  }

  @Get(
    'system-smoke/jobs/:jobId',
  )
  async getSystemSmokeJob(
    @Param('jobId')
    jobId:
      string,
  ) {
    const job =
      await this.bullMq.getQueueJob(
        BULLMQ_QUEUE_NAMES.SYSTEM,
        jobId,
      );

    if (
      !job
    ) {
      return {
        found:
          false,

        jobId,
      };
    }

    return {
      found:
        true,

      job: {
        id:
          job.id,

        name:
          job.name,

        data:
          job.data,

        progress:
          job.progress,

        attemptsMade:
          job.attemptsMade,

        failedReason:
          job.failedReason,

        timestamp:
          job.timestamp,

        processedOn:
          job.processedOn,

        finishedOn:
          job.finishedOn,
      },
    };
  }

  @Get(
    'notifications',
  )
  async getNotificationsQueue() {
    return this.bullMq.getQueueCounts(
      BULLMQ_QUEUE_NAMES.NOTIFICATIONS,
    );
  }

  @Get(
    'notifications/jobs/:jobId',
  )
  async getNotificationJob(
    @Param('jobId')
    jobId:
      string,
  ) {
    const job =
      await this.bullMq.getQueueJob(
        BULLMQ_QUEUE_NAMES.NOTIFICATIONS,
        jobId,
      );

    if (
      !job
    ) {
      return {
        found:
          false,

        jobId,
      };
    }

    return {
      found:
        true,

      job: {
        id:
          job.id,

        name:
          job.name,

        data:
          job.data,

        progress:
          job.progress,

        attemptsMade:
          job.attemptsMade,

        failedReason:
          job.failedReason,

        timestamp:
          job.timestamp,

        processedOn:
          job.processedOn,

        finishedOn:
          job.finishedOn,
      },
    };
  }
}