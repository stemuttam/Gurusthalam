import {
  canTransitionCourseLifecycle,
  getAllowedCourseLifecycleTransitions,
  isTerminalCourseLifecycleStatus,
} from './course-lifecycle.policy.js';

import {
  type CourseStatus as CourseStatusValue,
} from '../enums/course-status.js';

/**
 * Immutable read-side representation of the capabilities of a Course
 * at a specific lifecycle state.
 *
 * This contract intentionally composes the canonical lifecycle policy
 * instead of introducing a second transition graph or state machine.
 *
 * The capability is suitable for:
 * - application-layer decisions
 * - query/read models
 * - API response mapping
 * - administrative lifecycle views
 * - future workflow orchestration
 *
 * It intentionally contains no:
 * - persistence concerns
 * - Prisma types
 * - HTTP DTOs
 * - NestJS dependencies
 * - queues
 * - notifications
 * - AI/ML metadata
 */
export interface CourseLifecycleCapabilities {
  readonly currentStatus: CourseStatusValue;
  readonly allowedNextStatuses: readonly CourseStatusValue[];
  readonly isTerminal: boolean;
  readonly canTransitionTo: (
    nextStatus: CourseStatusValue,
  ) => boolean;
}

/**
 * Describes the lifecycle capabilities available from a specific
 * Course lifecycle state.
 *
 * This function is a read-only projection over the canonical
 * Course lifecycle policy.
 *
 * It does not:
 * - mutate a Course aggregate
 * - emit domain events
 * - access persistence
 * - execute workflow operations
 */
export function getCourseLifecycleCapabilities(
  currentStatus: CourseStatusValue,
): CourseLifecycleCapabilities {
  const allowedNextStatuses = Object.freeze([
    ...getAllowedCourseLifecycleTransitions(currentStatus),
  ]);

  return Object.freeze({
    currentStatus,
    allowedNextStatuses,
    isTerminal: isTerminalCourseLifecycleStatus(currentStatus),
    canTransitionTo: (nextStatus: CourseStatusValue): boolean =>
      canTransitionCourseLifecycle(currentStatus, nextStatus),
  });
}