import { describe, expect, it } from 'vitest';
import {
  canTransitionCourseLifecycle,
  COURSE_LIFECYCLE_TRANSITIONS,
  getAllowedCourseLifecycleTransitions,
  isTerminalCourseLifecycleStatus,
} from './course-lifecycle.policy.js';
import { CourseStatus } from '../enums/course-status.js';

describe('Course lifecycle policy', () => {
  describe('transition graph', () => {
    it('exposes the complete lifecycle transition graph', () => {
      expect(COURSE_LIFECYCLE_TRANSITIONS).toEqual({
        [CourseStatus.DRAFT]: [CourseStatus.IN_REVIEW],
        [CourseStatus.IN_REVIEW]: [CourseStatus.PUBLISHED],
        [CourseStatus.PUBLISHED]: [
          CourseStatus.UNPUBLISHED,
          CourseStatus.ARCHIVED,
        ],
        [CourseStatus.UNPUBLISHED]: [CourseStatus.ARCHIVED],
        [CourseStatus.ARCHIVED]: [],
      });
    });

    it('allows every valid lifecycle transition', () => {
      expect(
        canTransitionCourseLifecycle(
          CourseStatus.DRAFT,
          CourseStatus.IN_REVIEW,
        ),
      ).toBe(true);

      expect(
        canTransitionCourseLifecycle(
          CourseStatus.IN_REVIEW,
          CourseStatus.PUBLISHED,
        ),
      ).toBe(true);

      expect(
        canTransitionCourseLifecycle(
          CourseStatus.PUBLISHED,
          CourseStatus.UNPUBLISHED,
        ),
      ).toBe(true);

      expect(
        canTransitionCourseLifecycle(
          CourseStatus.PUBLISHED,
          CourseStatus.ARCHIVED,
        ),
      ).toBe(true);

      expect(
        canTransitionCourseLifecycle(
          CourseStatus.UNPUBLISHED,
          CourseStatus.ARCHIVED,
        ),
      ).toBe(true);
    });

    it('rejects every invalid lifecycle transition', () => {
      const statuses = Object.values(CourseStatus);

      for (const currentStatus of statuses) {
        for (const nextStatus of statuses) {
          const expected =
            COURSE_LIFECYCLE_TRANSITIONS[currentStatus].includes(nextStatus);

          expect(canTransitionCourseLifecycle(currentStatus, nextStatus)).toBe(
            expected,
          );
        }
      }
    });
  });

  describe('allowed transitions', () => {
    it('returns the allowed next states for DRAFT', () => {
      expect(getAllowedCourseLifecycleTransitions(CourseStatus.DRAFT)).toEqual([
        CourseStatus.IN_REVIEW,
      ]);
    });

    it('returns the allowed next states for IN_REVIEW', () => {
      expect(
        getAllowedCourseLifecycleTransitions(CourseStatus.IN_REVIEW),
      ).toEqual([CourseStatus.PUBLISHED]);
    });

    it('returns both supported transitions from PUBLISHED', () => {
      expect(
        getAllowedCourseLifecycleTransitions(CourseStatus.PUBLISHED),
      ).toEqual([CourseStatus.UNPUBLISHED, CourseStatus.ARCHIVED]);
    });

    it('returns ARCHIVED as the only next state from UNPUBLISHED', () => {
      expect(
        getAllowedCourseLifecycleTransitions(CourseStatus.UNPUBLISHED),
      ).toEqual([CourseStatus.ARCHIVED]);
    });

    it('returns no transitions from ARCHIVED', () => {
      expect(
        getAllowedCourseLifecycleTransitions(CourseStatus.ARCHIVED),
      ).toEqual([]);
    });

    it('returns a defensive copy that cannot mutate the policy', () => {
  const first = getAllowedCourseLifecycleTransitions(
    CourseStatus.PUBLISHED,
  ) as CourseStatus[];

  first.length = 0;

  expect(
    getAllowedCourseLifecycleTransitions(CourseStatus.PUBLISHED),
  ).toEqual([
    CourseStatus.UNPUBLISHED,
    CourseStatus.ARCHIVED,
  ]);
});
  });

  describe('terminal state', () => {
    it('identifies ARCHIVED as terminal', () => {
      expect(isTerminalCourseLifecycleStatus(CourseStatus.ARCHIVED)).toBe(true);
    });

    it('identifies non-terminal states correctly', () => {
      expect(isTerminalCourseLifecycleStatus(CourseStatus.DRAFT)).toBe(false);

      expect(isTerminalCourseLifecycleStatus(CourseStatus.IN_REVIEW)).toBe(
        false,
      );

      expect(isTerminalCourseLifecycleStatus(CourseStatus.PUBLISHED)).toBe(
        false,
      );

      expect(isTerminalCourseLifecycleStatus(CourseStatus.UNPUBLISHED)).toBe(
        false,
      );
    });
  });
});
