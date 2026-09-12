import { describe, expect, it } from 'vitest';

import {
  getCourseLifecycleCapabilities,
} from './course-lifecycle.capabilities.js';

import {
  CourseStatus,
  type CourseStatus as CourseStatusValue,
} from '../enums/course-status.js';

describe('Course lifecycle capabilities', () => {
  describe('state projection', () => {
    it('describes the DRAFT lifecycle capabilities', () => {
      const capabilities = getCourseLifecycleCapabilities(
        CourseStatus.DRAFT,
      );

      expect(capabilities.currentStatus).toBe(CourseStatus.DRAFT);
      expect(capabilities.allowedNextStatuses).toEqual([
        CourseStatus.IN_REVIEW,
      ]);
      expect(capabilities.isTerminal).toBe(false);
    });

    it('describes the IN_REVIEW lifecycle capabilities', () => {
      const capabilities = getCourseLifecycleCapabilities(
        CourseStatus.IN_REVIEW,
      );

      expect(capabilities.currentStatus).toBe(CourseStatus.IN_REVIEW);
      expect(capabilities.allowedNextStatuses).toEqual([
        CourseStatus.PUBLISHED,
      ]);
      expect(capabilities.isTerminal).toBe(false);
    });

    it('describes both PUBLISHED lifecycle exits', () => {
      const capabilities = getCourseLifecycleCapabilities(
        CourseStatus.PUBLISHED,
      );

      expect(capabilities.currentStatus).toBe(CourseStatus.PUBLISHED);
      expect(capabilities.allowedNextStatuses).toEqual([
        CourseStatus.UNPUBLISHED,
        CourseStatus.ARCHIVED,
      ]);
      expect(capabilities.isTerminal).toBe(false);
    });

    it('describes the UNPUBLISHED lifecycle capabilities', () => {
      const capabilities = getCourseLifecycleCapabilities(
        CourseStatus.UNPUBLISHED,
      );

      expect(capabilities.currentStatus).toBe(CourseStatus.UNPUBLISHED);
      expect(capabilities.allowedNextStatuses).toEqual([
        CourseStatus.ARCHIVED,
      ]);
      expect(capabilities.isTerminal).toBe(false);
    });

    it('describes ARCHIVED as terminal', () => {
      const capabilities = getCourseLifecycleCapabilities(
        CourseStatus.ARCHIVED,
      );

      expect(capabilities.currentStatus).toBe(CourseStatus.ARCHIVED);
      expect(capabilities.allowedNextStatuses).toEqual([]);
      expect(capabilities.isTerminal).toBe(true);
    });
  });

  describe('transition eligibility', () => {
    it('delegates valid transition decisions to the canonical policy', () => {
      const draft = getCourseLifecycleCapabilities(
        CourseStatus.DRAFT,
      );
      const review = getCourseLifecycleCapabilities(
        CourseStatus.IN_REVIEW,
      );
      const published = getCourseLifecycleCapabilities(
        CourseStatus.PUBLISHED,
      );
      const unpublished = getCourseLifecycleCapabilities(
        CourseStatus.UNPUBLISHED,
      );

      expect(draft.canTransitionTo(CourseStatus.IN_REVIEW)).toBe(true);
      expect(review.canTransitionTo(CourseStatus.PUBLISHED)).toBe(true);
      expect(
        published.canTransitionTo(CourseStatus.UNPUBLISHED),
      ).toBe(true);
      expect(
        published.canTransitionTo(CourseStatus.ARCHIVED),
      ).toBe(true);
      expect(
        unpublished.canTransitionTo(CourseStatus.ARCHIVED),
      ).toBe(true);
    });

    it('rejects invalid transitions without changing the capability snapshot', () => {
      const capabilities = getCourseLifecycleCapabilities(
        CourseStatus.UNPUBLISHED,
      );

      expect(
        capabilities.canTransitionTo(CourseStatus.PUBLISHED),
      ).toBe(false);

      expect(capabilities.currentStatus).toBe(
        CourseStatus.UNPUBLISHED,
      );

      expect(capabilities.allowedNextStatuses).toEqual([
        CourseStatus.ARCHIVED,
      ]);
    });

    it('rejects every transition from ARCHIVED', () => {
      const capabilities = getCourseLifecycleCapabilities(
        CourseStatus.ARCHIVED,
      );

      for (const nextStatus of Object.values(CourseStatus)) {
        expect(capabilities.canTransitionTo(nextStatus)).toBe(false);
      }
    });
  });

  describe('immutability', () => {
    it('freezes the capability object and its transition collection', () => {
      const capabilities = getCourseLifecycleCapabilities(
        CourseStatus.PUBLISHED,
      );

      expect(Object.isFrozen(capabilities)).toBe(true);
      expect(
        Object.isFrozen(capabilities.allowedNextStatuses),
      ).toBe(true);

      expect(() => {
        (
          capabilities.allowedNextStatuses as CourseStatusValue[]
        ).pop();
      }).toThrow();

      expect(
        getCourseLifecycleCapabilities(
          CourseStatus.PUBLISHED,
        ).allowedNextStatuses,
      ).toEqual([
        CourseStatus.UNPUBLISHED,
        CourseStatus.ARCHIVED,
      ]);
    });

    it('returns independent immutable snapshots', () => {
      const first = getCourseLifecycleCapabilities(
        CourseStatus.PUBLISHED,
      );
      const second = getCourseLifecycleCapabilities(
        CourseStatus.PUBLISHED,
      );

      expect(first).not.toBe(second);
      expect(first.allowedNextStatuses).not.toBe(
        second.allowedNextStatuses,
      );
      expect(first.allowedNextStatuses).toEqual(
        second.allowedNextStatuses,
      );
    });
  });
});