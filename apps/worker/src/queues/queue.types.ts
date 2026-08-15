import type { Worker } from 'bullmq';

export interface RegisteredWorker {
  readonly name: string;
  readonly worker: Worker;
}