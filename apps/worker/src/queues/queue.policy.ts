export const WORKER_CONCURRENCY = 5;

export const WORKER_OPTIONS = {
  autorun: true,

  concurrency:
    WORKER_CONCURRENCY,

  limiter: {
    max: 100,
    duration: 1000,
  },

  /*
   * Explicit stalled-job recovery configuration.
   */
  stalledInterval: 5_000,

  maxStalledCount: 3,

  lockDuration: 30_000,
} as const;