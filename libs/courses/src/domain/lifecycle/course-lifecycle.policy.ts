import {
  CourseStatus,
  type CourseStatus as CourseStatusValue,
} from '../enums/course-status.js';

/**
 * Immutable Course lifecycle transition graph.
 *
 * This is the single source of truth for lifecycle eligibility.
 *
 * Domain responsibilities intentionally limited to:
 * - lifecycle state transitions
 * - transition eligibility
 * - terminal-state semantics
 *
 * This policy has no dependency on:
 * - persistence
 * - Prisma
 * - NestJS
 * - HTTP
 * - queues
 * - notifications
 * - AI/ML
 * - application services
 */
const COURSE_LIFECYCLE_TRANSITIONS: Readonly<
  Record<CourseStatusValue, readonly CourseStatusValue[]>
> = Object.freeze({
  [CourseStatus.DRAFT]: Object.freeze([CourseStatus.IN_REVIEW]),

  [CourseStatus.IN_REVIEW]: Object.freeze([CourseStatus.PUBLISHED]),

  [CourseStatus.PUBLISHED]: Object.freeze([
    CourseStatus.UNPUBLISHED,
    CourseStatus.ARCHIVED,
  ]),

  [CourseStatus.UNPUBLISHED]: Object.freeze([CourseStatus.ARCHIVED]),

  [CourseStatus.ARCHIVED]: Object.freeze([]),
});

/**
 * Returns whether a lifecycle transition is permitted by the
 * Course aggregate lifecycle contract.
 *
 * This function performs eligibility evaluation only.
 * It does not mutate aggregate state or emit domain events.
 */
export function canTransitionCourseLifecycle(
  currentStatus: CourseStatusValue,
  nextStatus: CourseStatusValue,
): boolean {
  return COURSE_LIFECYCLE_TRANSITIONS[currentStatus].includes(nextStatus);
}

/**
 * Returns all lifecycle states that may immediately follow
 * the supplied current state.
 *
 * The returned array is a defensive copy so callers cannot
 * mutate the lifecycle policy.
 */
export function getAllowedCourseLifecycleTransitions(
  currentStatus: CourseStatusValue,
): readonly CourseStatusValue[] {
  return [...COURSE_LIFECYCLE_TRANSITIONS[currentStatus]];
}

/**
 * Returns whether the supplied lifecycle state is terminal.
 *
 * A terminal Course cannot transition to another lifecycle state.
 */
export function isTerminalCourseLifecycleStatus(
  status: CourseStatusValue,
): boolean {
  return COURSE_LIFECYCLE_TRANSITIONS[status].length === 0;
}

/**
 * Public immutable snapshot of the Course lifecycle graph.
 *
 * Consumers that need to inspect lifecycle capabilities may use
 * this contract without depending on Course aggregate internals.
 */
export { COURSE_LIFECYCLE_TRANSITIONS };
