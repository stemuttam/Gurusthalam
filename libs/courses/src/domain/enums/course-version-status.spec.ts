import { describe, expect, it } from 'vitest';

import {
  COURSE_VERSION_STATUSES,
  CourseVersionStatus,
  isCourseVersionStatus,
} from './course-version-status.js';

describe('CourseVersionStatus', () => {
  it('contains all supported CourseVersion statuses', () => {
    expect(COURSE_VERSION_STATUSES).toEqual([
      CourseVersionStatus.DRAFT,
      CourseVersionStatus.IN_REVIEW,
      CourseVersionStatus.PUBLISHED,
      CourseVersionStatus.ARCHIVED,
    ]);
  });

  it('contains no duplicate statuses', () => {
    expect(new Set(COURSE_VERSION_STATUSES).size).toBe(
      COURSE_VERSION_STATUSES.length,
    );
  });

  it('recognizes valid CourseVersion statuses', () => {
    for (const status of COURSE_VERSION_STATUSES) {
      expect(isCourseVersionStatus(status)).toBe(true);
    }
  });

  it('rejects invalid status values', () => {
    expect(isCourseVersionStatus('INVALID')).toBe(false);
    expect(isCourseVersionStatus('')).toBe(false);
    expect(isCourseVersionStatus('UNPUBLISHED')).toBe(false);
    expect(isCourseVersionStatus(null)).toBe(false);
    expect(isCourseVersionStatus(undefined)).toBe(false);
    expect(isCourseVersionStatus(123)).toBe(false);
    expect(isCourseVersionStatus({})).toBe(false);
  });

  it('exposes the expected runtime values', () => {
    expect(CourseVersionStatus).toEqual({
      DRAFT: 'DRAFT',
      IN_REVIEW: 'IN_REVIEW',
      PUBLISHED: 'PUBLISHED',
      ARCHIVED: 'ARCHIVED',
    });
  });
});