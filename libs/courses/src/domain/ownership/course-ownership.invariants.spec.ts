import { describe, expect, it } from 'vitest';

import { Course } from '../entities/course.js';

import { CourseLevel } from '../enums/course-level.js';

import { CourseStatus } from '../enums/course-status.js';

import { CourseType } from '../enums/course-type.js';

import { CourseActorId } from './identifiers/course-actor-id.js';

import {
  COURSE_OWNERSHIP_ROLES,
  CourseOwnershipRole,
} from './enums/course-ownership-role.js';

import { createCourseOwnershipAssignment } from './value-objects/course-ownership-assignment.js';

import { CourseOwnership } from './value-objects/course-ownership.js';

import { CourseValidationError } from '../errors/index.js';

describe('Course ownership authorization-independent domain invariants', () => {
  const ownerId = CourseActorId.from('actor-owner');

  const authorId = CourseActorId.from('actor-author');

  const editorId = CourseActorId.from('actor-editor');

  const reviewerId = CourseActorId.from('actor-reviewer');

  const createOwnerAssignment = (principalId: CourseActorId = ownerId) =>
    createCourseOwnershipAssignment({
      principalId,

      role: CourseOwnershipRole.OWNER,
    });

  const createAuthorAssignment = (principalId: CourseActorId = authorId) =>
    createCourseOwnershipAssignment({
      principalId,

      role: CourseOwnershipRole.AUTHOR,
    });

  const createCourse = () =>
    Course.create({
      title: 'Ownership Invariants Course',

      description: 'Course used to validate ownership invariants.',

      level: CourseLevel.BEGINNER,

      type: CourseType.SELF_PACED,

      instructorId: 'instructor-legacy-001',
    });

  describe('identity invariants', () => {
    it('treats CourseActorId as an opaque external identity', () => {
      const actor = CourseActorId.from('external-user-2026');

      expect(actor.toString()).toBe('external-user-2026');

      expect(actor.value).toBe('external-user-2026');
    });

    it('does not require UUID or Instructor-specific identity syntax', () => {
      expect(CourseActorId.from('user-organization-42').toString()).toBe(
        'user-organization-42',
      );

      expect(CourseActorId.from('instructor-profile-abc').toString()).toBe(
        'instructor-profile-abc',
      );
    });

    it('compares actor identities by value rather than object identity', () => {
      const first = CourseActorId.from('same-actor');

      const second = CourseActorId.from('same-actor');

      expect(first).not.toBe(second);

      expect(first.equals(second)).toBe(true);
    });
  });

  describe('role invariants', () => {
    it('supports the complete architecture-defined ownership vocabulary', () => {
      expect(COURSE_OWNERSHIP_ROLES).toEqual([
        CourseOwnershipRole.OWNER,
        CourseOwnershipRole.AUTHOR,
        CourseOwnershipRole.CO_AUTHOR,
        CourseOwnershipRole.EDITOR,
        CourseOwnershipRole.REVIEWER,
        CourseOwnershipRole.PUBLISHER,
      ]);
    });

    it('does not treat INSTRUCTOR as an ownership role', () => {
      expect(
        (Object.values(CourseOwnershipRole) as string[]).includes('INSTRUCTOR'),
      ).toBe(false);
    });

    it('allows a valid ownership role without any authorization context', () => {
      const assignment = createCourseOwnershipAssignment({
        principalId: editorId,

        role: CourseOwnershipRole.EDITOR,
      });

      expect(assignment.principalId.equals(editorId)).toBe(true);

      expect(assignment.role).toBe(CourseOwnershipRole.EDITOR);
    });

    it('rejects an unsupported ownership role at the domain boundary', () => {
      expect(() =>
        createCourseOwnershipAssignment({
          principalId: editorId,

          role: 'ADMIN' as CourseOwnershipRole,
        }),
      ).toThrow(CourseValidationError);
    });
  });

  describe('assignment invariants', () => {
    it('requires a real CourseActorId', () => {
      expect(() =>
        createCourseOwnershipAssignment({
          principalId: 'raw-user-id' as unknown as CourseActorId,

          role: CourseOwnershipRole.AUTHOR,
        }),
      ).toThrow(CourseValidationError);
    });

    it('allows the same principal to hold different ownership roles', () => {
      const ownership = CourseOwnership.create([
        createCourseOwnershipAssignment({
          principalId: authorId,

          role: CourseOwnershipRole.AUTHOR,
        }),

        createCourseOwnershipAssignment({
          principalId: authorId,

          role: CourseOwnershipRole.EDITOR,
        }),
      ]);

      expect(ownership.getForPrincipal(authorId)).toHaveLength(2);
    });

    it('rejects duplicate principal-role assignments', () => {
      expect(() =>
        CourseOwnership.create([
          createAuthorAssignment(authorId),

          createAuthorAssignment(authorId),
        ]),
      ).toThrow('Course ownership contains duplicate assignments.');
    });
  });

  describe('collection invariants', () => {
    it('allows an ownership collection with no Owner', () => {
      const ownership = CourseOwnership.create([createAuthorAssignment()]);

      expect(ownership.hasOwner()).toBe(false);

      expect(ownership.getOwner()).toBeNull();
    });

    it('allows exactly one Owner', () => {
      const ownership = CourseOwnership.create([createOwnerAssignment()]);

      expect(ownership.getForRole(CourseOwnershipRole.OWNER)).toHaveLength(1);
    });

    it('rejects multiple Owners', () => {
      expect(() =>
        CourseOwnership.create([
          createOwnerAssignment(ownerId),

          createOwnerAssignment(CourseActorId.from('actor-owner-2')),
        ]),
      ).toThrow('Course ownership contains multiple Owners.');
    });

    it('preserves deterministic assignment order', () => {
      const ownership = CourseOwnership.create([
        createOwnerAssignment(),
        createAuthorAssignment(),
        createCourseOwnershipAssignment({
          principalId: editorId,

          role: CourseOwnershipRole.EDITOR,
        }),
        createCourseOwnershipAssignment({
          principalId: reviewerId,

          role: CourseOwnershipRole.REVIEWER,
        }),
      ]);

      const assignments = ownership.getAssignments();

      expect(assignments.map((assignment) => assignment.role)).toEqual([
        CourseOwnershipRole.OWNER,
        CourseOwnershipRole.AUTHOR,
        CourseOwnershipRole.EDITOR,
        CourseOwnershipRole.REVIEWER,
      ]);
    });
  });

  describe('mutation invariants', () => {
    it('does not mutate the original ownership collection when adding', () => {
      const initial = CourseOwnership.create([createOwnerAssignment()]);

      const updated = initial.add(createAuthorAssignment());

      expect(initial.size).toBe(1);

      expect(updated.size).toBe(2);

      expect(initial.has(authorId, CourseOwnershipRole.AUTHOR)).toBe(false);

      expect(updated.has(authorId, CourseOwnershipRole.AUTHOR)).toBe(true);
    });

    it('does not mutate the original ownership collection when removing', () => {
      const initial = CourseOwnership.create([
        createOwnerAssignment(),
        createAuthorAssignment(),
      ]);

      const updated = initial.remove(authorId, CourseOwnershipRole.AUTHOR);

      expect(initial.size).toBe(2);

      expect(updated.size).toBe(1);

      expect(initial.has(authorId, CourseOwnershipRole.AUTHOR)).toBe(true);

      expect(updated.has(authorId, CourseOwnershipRole.AUTHOR)).toBe(false);
    });

    it('treats removal of an absent assignment as a value-level no-op', () => {
      const initial = CourseOwnership.create([createOwnerAssignment()]);

      const updated = initial.remove(authorId, CourseOwnershipRole.AUTHOR);

      expect(updated.equals(initial)).toBe(true);

      expect(updated).not.toBe(initial);
    });

    it('rejects a second Owner without changing the existing collection', () => {
      const initial = CourseOwnership.create([createOwnerAssignment()]);

      expect(() =>
        initial.add(createOwnerAssignment(CourseActorId.from('actor-owner-2'))),
      ).toThrow('Course ownership already has an Owner.');

      expect(initial.size).toBe(1);

      expect(initial.getOwner()?.principalId.equals(ownerId)).toBe(true);
    });
  });

  describe('Course aggregate authorization independence', () => {
    it('keeps legacy instructorId independent from ownership', () => {
      const course = Course.create({
        title: 'Separate Identity Course',

        level: CourseLevel.BEGINNER,

        type: CourseType.SELF_PACED,

        instructorId: 'instructor-legacy-001',

        ownership: CourseOwnership.create([createOwnerAssignment(ownerId)]),
      });

      expect(course.instructorId).toBe('instructor-legacy-001');

      expect(course.ownership.getOwner()?.principalId.equals(ownerId)).toBe(
        true,
      );
    });

    it('allows ownership mutation without authentication or authorization state', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.addOwnershipAssignment({
        principalId: authorId,

        role: CourseOwnershipRole.AUTHOR,
      });

      expect(course.ownership.has(authorId, CourseOwnershipRole.AUTHOR)).toBe(
        true,
      );

      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('does not emit ownership-specific domain events', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.addOwnershipAssignment(createAuthorAssignment());

      course.addOwnershipAssignment(
        createCourseOwnershipAssignment({
          principalId: editorId,

          role: CourseOwnershipRole.EDITOR,
        }),
      );

      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('rehydrates ownership without creating a domain event', () => {
      const ownership = CourseOwnership.create([
        createOwnerAssignment(),
        createAuthorAssignment(),
      ]);

      const original = Course.create({
        title: 'Rehydrated Ownership Course',

        level: CourseLevel.BEGINNER,

        type: CourseType.SELF_PACED,

        instructorId: 'instructor-legacy-001',

        ownership,
      });

      const rehydrated = Course.rehydrate(original.toPrimitives(), ownership);

      expect(rehydrated.status).toBe(CourseStatus.DRAFT);

      expect(rehydrated.ownership.equals(ownership)).toBe(true);

      expect(rehydrated.getDomainEvents()).toHaveLength(0);
    });

    it('does not change Course ownership when a duplicate assignment is rejected', () => {
      const course = createCourse();

      course.addOwnershipAssignment(createAuthorAssignment());

      expect(() =>
        course.addOwnershipAssignment(createAuthorAssignment()),
      ).toThrow(CourseValidationError);

      expect(course.ownership.size).toBe(1);

      expect(course.ownership.has(authorId, CourseOwnershipRole.AUTHOR)).toBe(
        true,
      );
    });

    it('does not change Course ownership when a second Owner is rejected', () => {
      const course = createCourse();

      course.addOwnershipAssignment(createOwnerAssignment());

      expect(() =>
        course.addOwnershipAssignment(
          createOwnerAssignment(CourseActorId.from('actor-owner-2')),
        ),
      ).toThrow(CourseValidationError);

      expect(course.ownership.size).toBe(1);

      expect(course.ownership.getOwner()?.principalId.equals(ownerId)).toBe(
        true,
      );
    });

    it('keeps ownership immutable from externally returned snapshots', () => {
      const ownership = CourseOwnership.create([
        createOwnerAssignment(),
        createAuthorAssignment(),
      ]);

      const assignments = ownership.getAssignments();

      expect(assignments).not.toBe(ownership.getAssignments());

      expect(Object.isFrozen(assignments[0])).toBe(true);

      expect(Object.isFrozen(assignments[1])).toBe(true);

      expect(Object.isFrozen(ownership)).toBe(true);
    });
  });
});
