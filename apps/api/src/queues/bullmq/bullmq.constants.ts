export const BULLMQ_PREFIX = 'gurusthalam';

export const BULLMQ_QUEUE_NAMES = {
  SYSTEM: 'system',
} as const;

export type BullMqQueueName =
  (typeof BULLMQ_QUEUE_NAMES)[keyof typeof BULLMQ_QUEUE_NAMES];