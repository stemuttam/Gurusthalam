import {
  AssessmentStatus,
  type AssessmentStatus as AssessmentStatusValue,
} from '../enums/assessment-status.js';

/**
 * Immutable Assessment lifecycle transition graph.
 *
 * DRAFT
 *   -> PUBLISHED
 *
 * PUBLISHED
 *   -> ARCHIVED
 *
 * ARCHIVED
 *   -> terminal
 *
 * This is the generic Assessment lifecycle only.
 *
 * Publication readiness rules that depend on Question Bank, Quiz,
 * Assignment, Exam, or other specialized domains are intentionally
 * excluded from this policy.
 *
 * The policy has no dependency on:
 * - Prisma or PostgreSQL;
 * - NestJS or HTTP;
 * - repositories or application services;
 * - Redis, queues, or outbox infrastructure;
 * - notifications;
 * - AI/ML systems.
 */
const ASSESSMENT_LIFECYCLE_TRANSITIONS: Readonly<
  Record<AssessmentStatusValue, readonly AssessmentStatusValue[]>
> = Object.freeze({
  [AssessmentStatus.DRAFT]: Object.freeze([AssessmentStatus.PUBLISHED]),

  [AssessmentStatus.PUBLISHED]: Object.freeze([AssessmentStatus.ARCHIVED]),

  [AssessmentStatus.ARCHIVED]: Object.freeze([]),
});

/**
 * Returns whether the requested Assessment lifecycle transition is allowed.
 *
 * This function evaluates eligibility only. It does not mutate an
 * Assessment aggregate or perform authorization.
 */
export function canTransitionAssessmentLifecycle(
  currentStatus: AssessmentStatusValue,
  nextStatus: AssessmentStatusValue,
): boolean {
  return ASSESSMENT_LIFECYCLE_TRANSITIONS[currentStatus].includes(nextStatus);
}

/**
 * Returns the lifecycle states immediately reachable from the supplied
 * Assessment status.
 *
 * A defensive copy prevents consumers from mutating the policy.
 */
export function getAllowedAssessmentLifecycleTransitions(
  currentStatus: AssessmentStatusValue,
): readonly AssessmentStatusValue[] {
  return [...ASSESSMENT_LIFECYCLE_TRANSITIONS[currentStatus]];
}

/**
 * Determines whether an Assessment lifecycle state is terminal.
 */
export function isTerminalAssessmentLifecycleStatus(
  status: AssessmentStatusValue,
): boolean {
  return ASSESSMENT_LIFECYCLE_TRANSITIONS[status].length === 0;
}

/**
 * Public immutable snapshot of the Assessment lifecycle graph.
 */
export { ASSESSMENT_LIFECYCLE_TRANSITIONS };
