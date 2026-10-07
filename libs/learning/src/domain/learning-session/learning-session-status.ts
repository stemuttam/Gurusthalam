export const LearningSessionStatus = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  ABANDONED: 'ABANDONED',
} as const;

export type LearningSessionStatus =
  (typeof LearningSessionStatus)[keyof typeof LearningSessionStatus];
