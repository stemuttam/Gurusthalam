export const WORKER_CONCURRENCY = 5;

export const WORKER_OPTIONS = {
  autorun: true,
  concurrency: WORKER_CONCURRENCY,
  limiter: {
    max: 100,
    duration: 1000,
  },
} as const;