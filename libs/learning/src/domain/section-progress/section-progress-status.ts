export const SectionProgressStatus = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
} as const;

export type SectionProgressStatus =
  (typeof SectionProgressStatus)[keyof typeof SectionProgressStatus];

export const SECTION_PROGRESS_STATUSES = Object.freeze([
  SectionProgressStatus.NOT_STARTED,
  SectionProgressStatus.IN_PROGRESS,
  SectionProgressStatus.COMPLETED,
] as const);

export function isSectionProgressStatus(
  value: string,
): value is SectionProgressStatus {
  return SECTION_PROGRESS_STATUSES.includes(value as SectionProgressStatus);
}
