import { describe, expect, it } from 'vitest';

import {
  CourseOwnershipRole,
  COURSE_OWNERSHIP_ROLES,
} from '../enums/course-ownership-role.js';
import { CourseActorId } from '../identifiers/course-actor-id.js';
import {
  createCourseOwnershipAssignment,
  rehydrateCourseOwnershipAssignment,
} from './course-ownership-assignment.js';

describe('CourseOwnershipAssignment', () => {
  it('creates an immutable owner assignment', () => {
    const principalId = CourseActorId.from('user-owner-001');

    const assignment = createCourseOwnershipAssignment({
      principalId,
      role: CourseOwnershipRole.OWNER,
    });

    expect(assignment).toEqual({
      principalId,
      role: CourseOwnershipRole.OWNER,
    });

    expect(Object.isFrozen(assignment)).toBe(true);
  });

  it('supports every architecture-defined ownership role', () => {
    const principalId = CourseActorId.from('user-001');

    for (const role of COURSE_OWNERSHIP_ROLES) {
      const assignment = createCourseOwnershipAssignment({
        principalId,
        role,
      });

      expect(assignment.role).toBe(role);
      expect(assignment.principalId).toBe(principalId);
    }
  });

  it('preserves the actor identity independently from the role', () => {
    const principalId = CourseActorId.from('user-001');

    const assignment = createCourseOwnershipAssignment({
      principalId,
      role: CourseOwnershipRole.AUTHOR,
    });

    expect(assignment.principalId).toBe(principalId);

    expect(assignment.principalId.toString()).toBe('user-001');

    expect(assignment.role).toBe(CourseOwnershipRole.AUTHOR);
  });

  it('rehydrates an existing assignment', () => {
    const principalId = CourseActorId.from('user-002');

    const assignment = rehydrateCourseOwnershipAssignment({
      principalId,
      role: CourseOwnershipRole.EDITOR,
    });

    expect(assignment.principalId).toBe(principalId);

    expect(assignment.role).toBe(CourseOwnershipRole.EDITOR);

    expect(Object.isFrozen(assignment)).toBe(true);
  });

  it('rejects an invalid principal identifier', () => {
    expect(() =>
      createCourseOwnershipAssignment({
        principalId: 'user-invalid' as unknown as CourseActorId,
        role: CourseOwnershipRole.AUTHOR,
      }),
    ).toThrow('Course ownership assignment validation failed.');
  });

  it('rejects an invalid ownership role', () => {
    const principalId = CourseActorId.from('user-001');

    expect(() =>
      createCourseOwnershipAssignment({
        principalId,
        role: 'INSTRUCTOR' as CourseOwnershipRole,
      }),
    ).toThrow('Course ownership assignment validation failed.');
  });

  it('does not perform authorization checks', () => {
    const principalId = CourseActorId.from('user-001');

    const assignment = createCourseOwnershipAssignment({
      principalId,
      role: CourseOwnershipRole.PUBLISHER,
    });

    expect(assignment.role).toBe(CourseOwnershipRole.PUBLISHER);
  });
});
