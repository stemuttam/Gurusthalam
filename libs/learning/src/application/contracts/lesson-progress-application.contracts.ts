import type { LessonProgress } from '../../domain/lesson-progress/index.js';

export interface StartLessonProgressInput {
  readonly enrollmentId: string;
  readonly learningUnitId: string;
  readonly now?: string;
}

export interface GetLessonProgressInput {
  readonly lessonProgressId: string;
}

export interface GetLessonProgressByEnrollmentAndLearningUnitInput {
  readonly enrollmentId: string;
  readonly learningUnitId: string;
}

export interface UpdateLessonProgressInput {
  readonly enrollmentId: string;
  readonly learningUnitId: string;
  readonly percentage: number;
  readonly now?: string;
}

export interface CompleteLessonProgressInput {
  readonly enrollmentId: string;
  readonly learningUnitId: string;
  readonly now?: string;
}

export interface LessonProgressApplicationService {
  startLessonProgress(input: StartLessonProgressInput): Promise<LessonProgress>;

  getLessonProgress(
    input: GetLessonProgressInput,
  ): Promise<LessonProgress | null>;

  getLessonProgressByEnrollmentAndLearningUnit(
    input: GetLessonProgressByEnrollmentAndLearningUnitInput,
  ): Promise<LessonProgress | null>;

  updateLessonProgress(
    input: UpdateLessonProgressInput,
  ): Promise<LessonProgress>;

  completeLessonProgress(
    input: CompleteLessonProgressInput,
  ): Promise<LessonProgress>;
}
