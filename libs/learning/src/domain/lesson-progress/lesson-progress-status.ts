export const LessonProgressStatus = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
} as const;

export type LessonProgressStatus =
  (typeof LessonProgressStatus)[keyof typeof LessonProgressStatus];

export const LESSON_PROGRESS_STATUSES = Object.freeze([
  LessonProgressStatus.NOT_STARTED,
  LessonProgressStatus.IN_PROGRESS,
  LessonProgressStatus.COMPLETED,
] as const);

export function isLessonProgressStatus(
  value: string,
): value is LessonProgressStatus {
  return LESSON_PROGRESS_STATUSES.includes(value as LessonProgressStatus);
}
