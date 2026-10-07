export const ProgressStatus = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
} as const;

export type ProgressStatus =
  (typeof ProgressStatus)[keyof typeof ProgressStatus];

export const PROGRESS_STATUSES = Object.freeze([
  ProgressStatus.NOT_STARTED,
  ProgressStatus.IN_PROGRESS,
  ProgressStatus.COMPLETED,
] as const);

export function isProgressStatus(value: string): value is ProgressStatus {
  return PROGRESS_STATUSES.includes(value as ProgressStatus);
}
