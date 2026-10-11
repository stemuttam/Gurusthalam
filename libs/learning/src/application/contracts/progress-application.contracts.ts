import type { Progress } from '../../domain/progress/index.js';

export interface StartProgressInput {
  readonly enrollmentId: string;
  readonly now?: string;
}

export interface GetProgressInput {
  readonly progressId: string;
}

export interface GetProgressByEnrollmentInput {
  readonly enrollmentId: string;
}

export interface UpdateProgressInput {
  readonly enrollmentId: string;
  readonly percentage: number;
  readonly now?: string;
}

export interface CompleteProgressInput {
  readonly enrollmentId: string;
  readonly now?: string;
}

export interface ProgressApplicationService {
  startProgress(input: StartProgressInput): Promise<Progress>;

  getProgress(input: GetProgressInput): Promise<Progress | null>;

  getProgressByEnrollment(
    input: GetProgressByEnrollmentInput,
  ): Promise<Progress | null>;

  updateProgress(input: UpdateProgressInput): Promise<Progress>;

  completeProgress(input: CompleteProgressInput): Promise<Progress>;
}
