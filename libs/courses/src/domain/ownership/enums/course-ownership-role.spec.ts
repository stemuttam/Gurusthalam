import { describe, expect, it } from 'vitest';

import {
  COURSE_OWNERSHIP_ROLES,
  CourseOwnershipRole,
  isCourseOwnershipRole,
} from './course-ownership-role.js';

describe('CourseOwnershipRole', () => {
  it('exposes the architecture-defined ownership roles', () => {
    expect(COURSE_OWNERSHIP_ROLES).toEqual([
      CourseOwnershipRole.OWNER,
      CourseOwnershipRole.AUTHOR,
      CourseOwnershipRole.CO_AUTHOR,
      CourseOwnershipRole.EDITOR,
      CourseOwnershipRole.REVIEWER,
      CourseOwnershipRole.PUBLISHER,
    ]);
  });

  it('validates supported ownership roles', () => {
    for (const role of COURSE_OWNERSHIP_ROLES) {
      expect(isCourseOwnershipRole(role)).toBe(true);
    }
  });

  it('rejects unsupported values', () => {
    expect(isCourseOwnershipRole(undefined)).toBe(false);
    expect(isCourseOwnershipRole(null)).toBe(false);
    expect(isCourseOwnershipRole('')).toBe(false);
    expect(isCourseOwnershipRole('INSTRUCTOR')).toBe(false);
    expect(isCourseOwnershipRole('ADMIN')).toBe(false);
    expect(isCourseOwnershipRole(123)).toBe(false);
  });

  it('returns a readonly role vocabulary', () => {
    expect(Object.isFrozen(CourseOwnershipRole)).toBe(true);
  });
});
