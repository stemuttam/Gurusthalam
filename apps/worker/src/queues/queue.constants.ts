export const QUEUE_NAMES = {
  SYSTEM: 'system-smoke',

  NOTIFICATIONS: 'notifications',

  COURSE_EVENTS: 'course-events',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const QUEUE_PREFIX = 'gurusthalam';
