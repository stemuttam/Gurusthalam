import type { JobsOptions } from 'bullmq';

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: 100,
  removeOnFail: 1000,
};

export const SYSTEM_JOB_OPTIONS: JobsOptions = {
  ...DEFAULT_JOB_OPTIONS,
};