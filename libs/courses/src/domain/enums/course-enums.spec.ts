import { describe, expect, it } from 'vitest';

import {
  COURSE_LEVELS,
  COURSE_STATUSES,
  COURSE_TYPES,
  COURSE_VISIBILITIES,
  CourseLevel,
  CourseStatus,
  CourseType,
  CourseVisibility,
  isCourseLevel,
  isCourseStatus,
  isCourseType,
  isCourseVisibility,
} from './index.js';

describe('Course domain enumerations', () => {
  describe('CourseStatus', () => {
    it('exposes the canonical lifecycle states', () => {
      expect(COURSE_STATUSES).toEqual([
        CourseStatus.DRAFT,
        CourseStatus.IN_REVIEW,
        CourseStatus.PUBLISHED,
        CourseStatus.UNPUBLISHED,
        CourseStatus.ARCHIVED,
      ]);
    });

    it('accepts valid CourseStatus values', () => {
      for (const status of COURSE_STATUSES) {
        expect(isCourseStatus(status)).toBe(true);
      }
    });

    it('rejects invalid CourseStatus values', () => {
      expect(isCourseStatus('DELETED')).toBe(false);
      expect(isCourseStatus('')).toBe(false);
      expect(isCourseStatus(null)).toBe(false);
      expect(isCourseStatus(undefined)).toBe(false);
      expect(isCourseStatus(123)).toBe(false);
    });
  });

  describe('CourseVisibility', () => {
    it('exposes the canonical visibility states', () => {
      expect(COURSE_VISIBILITIES).toEqual([
        CourseVisibility.PRIVATE,
        CourseVisibility.UNLISTED,
        CourseVisibility.PUBLIC,
      ]);
    });

    it('accepts valid CourseVisibility values', () => {
      for (const visibility of COURSE_VISIBILITIES) {
        expect(isCourseVisibility(visibility)).toBe(true);
      }
    });

    it('rejects invalid CourseVisibility values', () => {
      expect(isCourseVisibility('HIDDEN')).toBe(false);
      expect(isCourseVisibility('')).toBe(false);
      expect(isCourseVisibility(null)).toBe(false);
      expect(isCourseVisibility(undefined)).toBe(false);
      expect(isCourseVisibility(false)).toBe(false);
    });
  });

  describe('CourseLevel', () => {
    it('exposes the canonical learner levels', () => {
      expect(COURSE_LEVELS).toEqual([
        CourseLevel.BEGINNER,
        CourseLevel.INTERMEDIATE,
        CourseLevel.ADVANCED,
        CourseLevel.ALL_LEVELS,
      ]);
    });

    it('accepts valid CourseLevel values', () => {
      for (const level of COURSE_LEVELS) {
        expect(isCourseLevel(level)).toBe(true);
      }
    });

    it('rejects invalid CourseLevel values', () => {
      expect(isCourseLevel('EXPERT')).toBe(false);
      expect(isCourseLevel('')).toBe(false);
      expect(isCourseLevel(null)).toBe(false);
      expect(isCourseLevel(undefined)).toBe(false);
      expect(isCourseLevel({})).toBe(false);
    });
  });

  describe('CourseType', () => {
    it('exposes the canonical delivery models', () => {
      expect(COURSE_TYPES).toEqual([
        CourseType.SELF_PACED,
        CourseType.LIVE,
        CourseType.BLENDED,
      ]);
    });

    it('accepts valid CourseType values', () => {
      for (const type of COURSE_TYPES) {
        expect(isCourseType(type)).toBe(true);
      }
    });

    it('rejects invalid CourseType values', () => {
      expect(isCourseType('RECORDED')).toBe(false);
      expect(isCourseType('')).toBe(false);
      expect(isCourseType(null)).toBe(false);
      expect(isCourseType(undefined)).toBe(false);
      expect(isCourseType([])).toBe(false);
    });
  });
});