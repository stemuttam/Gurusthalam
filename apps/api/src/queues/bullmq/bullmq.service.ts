import {
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';

import {
  Queue,
  type QueueOptions,
} from 'bullmq';

import { getRedisConfig } from '@gurusthalam/config';

import {
  BULLMQ_PREFIX,
  BULLMQ_QUEUE_NAMES,
  type BullMqQueueName,
} from './bullmq.constants.js';

@Injectable()
export class BullMqService
  implements OnModuleDestroy
{
  private readonly queues =
    new Map<
      BullMqQueueName,
      Queue
    >();

  private readonly connection:
    QueueOptions['connection'];

  constructor() {
    const config = getRedisConfig();

    this.connection = {
      url: config.url,
    };
  }

  getQueue(
    name: BullMqQueueName,
  ): Queue {
    const existing =
      this.queues.get(name);

    if (existing) {
      return existing;
    }

    const queue = new Queue(name, {
      connection: this.connection,
      prefix: BULLMQ_PREFIX,
    });

    this.queues.set(name, queue);

    return queue;
  }

  async ping(): Promise<boolean> {
    try {
      const queue =
        this.getQueue(
          BULLMQ_QUEUE_NAMES.SYSTEM,
        );

      await queue.waitUntilReady();

      return true;
    } catch {
      return false;
    }
  }

  async getQueueCounts(
    name: BullMqQueueName,
  ) {
    const queue =
      this.getQueue(name);

    return queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
    );
  }

  async getQueueJob(
    name: BullMqQueueName,
    jobId: string,
  ) {
    const queue =
      this.getQueue(name);

    return queue.getJob(jobId);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      Array.from(
        this.queues.values(),
        async (queue) => {
          await queue.close();
        },
      ),
    );

    this.queues.clear();
  }
}