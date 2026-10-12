import type { CourseProgressReadModel } from '../../domain/course-progress/index.js';

import type { CourseProgressReadModelSaveOutcome } from './course-progress-read-model-persistence.contracts.js';

export interface RefreshCourseProgressInput {
  readonly enrollmentId: string;
  readonly calculatedAt?: string;
}

export interface GetCourseProgressInput {
  readonly enrollmentId: string;
}

export interface RefreshCourseProgressResult {
  readonly outcome: CourseProgressReadModelSaveOutcome;
  readonly readModel: CourseProgressReadModel;
}

export interface CourseProgressApplicationService {
  refreshCourseProgress(
    input: RefreshCourseProgressInput,
  ): Promise<RefreshCourseProgressResult>;

  getCourseProgress(
    input: GetCourseProgressInput,
  ): Promise<CourseProgressReadModel | null>;
}
