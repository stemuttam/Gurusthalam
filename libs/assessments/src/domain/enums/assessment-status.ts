/**
 * Lifecycle state of a generic Assessment aggregate.
 *
 * This lifecycle deliberately describes the generic Assessment resource.
 * Quiz, Assignment, Exam, Attempt, Answer, Grading, and Result lifecycles
 * belong to their respective bounded contexts.
 */
export const AssessmentStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type AssessmentStatus =
  (typeof AssessmentStatus)[keyof typeof AssessmentStatus];

/**
 * Canonical immutable list of supported Assessment lifecycle states.
 */
export const ASSESSMENT_STATUSES = Object.freeze(
  Object.values(AssessmentStatus),
) as readonly AssessmentStatus[];

/**
 * Checks whether an unknown primitive is a supported Assessment status.
 */
export function isAssessmentStatus(value: unknown): value is AssessmentStatus {
  return (
    typeof value === 'string' &&
    ASSESSMENT_STATUSES.includes(value as AssessmentStatus)
  );
}
