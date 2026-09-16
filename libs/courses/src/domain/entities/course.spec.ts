import { describe, expect, it } from 'vitest';

import { Course } from './course.js';

import { CourseLevel } from '../enums/course-level.js';
import { CourseStatus } from '../enums/course-status.js';
import { CourseType } from '../enums/course-type.js';
import { CourseVisibility } from '../enums/course-visibility.js';

import {
  CourseOwnership,
  CourseActorId,
  CourseOwnershipRole,
  createCourseOwnershipAssignment,
} from '../ownership/index.js';

import {
  CourseValidationError,
  InvalidCourseStateTransitionError,
} from '../errors/index.js';

import { CourseDomainEventName } from '../events/course.events.js';

const createCourse = () =>
  Course.create({
    title: 'TypeScript Fundamentals',
    description: 'Learn TypeScript from the ground up.',
    level: CourseLevel.BEGINNER,
    type: CourseType.SELF_PACED,
    visibility: CourseVisibility.PRIVATE,
    instructorId: 'instructor-123',
  });

const createOwnerAssignment = (principalId = 'actor-owner') =>
  createCourseOwnershipAssignment({
    principalId: CourseActorId.from(principalId),
    role: CourseOwnershipRole.OWNER,
  });

const createAuthorAssignment = (principalId = 'actor-author') =>
  createCourseOwnershipAssignment({
    principalId: CourseActorId.from(principalId),
    role: CourseOwnershipRole.AUTHOR,
  });

describe('Course aggregate', () => {
  describe('create', () => {
    it('creates a Course in DRAFT status', () => {
      const course = createCourse();

      expect(course.id.value).toBeTypeOf('string');
      expect(course.title).toBe('TypeScript Fundamentals');
      expect(course.description).toBe('Learn TypeScript from the ground up.');
      expect(course.level).toBe(CourseLevel.BEGINNER);
      expect(course.type).toBe(CourseType.SELF_PACED);
      expect(course.visibility).toBe(CourseVisibility.PRIVATE);
      expect(course.status).toBe(CourseStatus.DRAFT);
      expect(course.instructorId).toBe('instructor-123');
    });

    it('starts without ownership when ownership is not supplied', () => {
      const course = createCourse();

      expect(course.ownership.size).toBe(0);
      expect(course.ownership.hasOwner()).toBe(false);
    });

    it('accepts explicit ownership during creation', () => {
      const owner = createOwnerAssignment();

      const course = Course.create({
        title: 'Owned Course',
        description: 'A Course with explicit ownership.',
        level: CourseLevel.BEGINNER,
        type: CourseType.SELF_PACED,
        instructorId: 'instructor-123',
        ownership: CourseOwnership.create([owner]),
      });

      expect(course.ownership.size).toBe(1);
      expect(course.ownership.hasOwner()).toBe(true);
      expect(course.ownership.getOwner()?.principalId).toBe(owner.principalId);
      expect(course.ownership.getOwner()?.role).toBe(CourseOwnershipRole.OWNER);
    });

    it('keeps instructor identity separate from ownership identity', () => {
      const owner = createOwnerAssignment('different-owner');

      const course = Course.create({
        title: 'Separated Ownership Course',
        level: CourseLevel.BEGINNER,
        type: CourseType.SELF_PACED,
        instructorId: 'instructor-123',
        ownership: CourseOwnership.create([owner]),
      });

      expect(course.instructorId).toBe('instructor-123');
      expect(
        course.ownership
          .getOwner()
          ?.principalId.equals(CourseActorId.from('different-owner')),
      ).toBe(true);
    });

    it('records CourseCreated', () => {
      const course = createCourse();

      const [event] = course.getDomainEvents();

      expect(event?.eventName).toBe(CourseDomainEventName.CREATED);
      expect(event?.aggregateId).toBe(course.id.toString());
    });

    it('defaults visibility to PRIVATE', () => {
      const course = Course.create({
        title: 'Test Course',
        level: CourseLevel.BEGINNER,
        type: CourseType.SELF_PACED,
        instructorId: 'instructor-123',
      });

      expect(course.visibility).toBe(CourseVisibility.PRIVATE);
    });

    it('creates distinct Course identifiers', () => {
      const first = createCourse();
      const second = createCourse();

      expect(first.id.equals(second.id)).toBe(false);
    });

    it('rejects an empty title', () => {
      expect(() =>
        Course.create({
          title: '   ',
          level: CourseLevel.BEGINNER,
          type: CourseType.SELF_PACED,
          instructorId: 'instructor-123',
        }),
      ).toThrow(CourseValidationError);
    });

    it('rejects an empty instructor identifier', () => {
      expect(() =>
        Course.create({
          title: 'Valid Course',
          level: CourseLevel.BEGINNER,
          type: CourseType.SELF_PACED,
          instructorId: '   ',
        }),
      ).toThrow(CourseValidationError);
    });

    it('rejects an empty description', () => {
      expect(() =>
        Course.create({
          title: 'Valid Course',
          description: '   ',
          level: CourseLevel.BEGINNER,
          type: CourseType.SELF_PACED,
          instructorId: 'instructor-123',
        }),
      ).toThrow(CourseValidationError);
    });
  });

  describe('ownership integration', () => {
    it('adds an ownership assignment through the aggregate', () => {
      const course = createCourse();
      const assignment = createAuthorAssignment();

      const previousUpdatedAt = course.updatedAt;

      course.addOwnershipAssignment(assignment);

      expect(course.ownership.size).toBe(1);
      expect(
        course.ownership.has(
          assignment.principalId,
          CourseOwnershipRole.AUTHOR,
        ),
      ).toBe(true);
      expect(course.updatedAt.getTime()).toBeGreaterThanOrEqual(
        previousUpdatedAt.getTime(),
      );
    });

    it('allows Instructor and Author to be different principals', () => {
      const course = createCourse();

      course.addOwnershipAssignment(createAuthorAssignment('author-456'));

      expect(course.instructorId).toBe('instructor-123');

      const authorAssignments = course.ownership.getForRole(
        CourseOwnershipRole.AUTHOR,
      );

      expect(authorAssignments).toHaveLength(1);
      expect(
        authorAssignments[0]?.principalId.equals(
          CourseActorId.from('author-456'),
        ),
      ).toBe(true);
    });

    it('allows multiple non-owner participation assignments', () => {
      const course = createCourse();

      course.addOwnershipAssignment(createAuthorAssignment('author-1'));

      course.addOwnershipAssignment(
        createCourseOwnershipAssignment({
          principalId: CourseActorId.from('editor-1'),
          role: CourseOwnershipRole.EDITOR,
        }),
      );

      course.addOwnershipAssignment(
        createCourseOwnershipAssignment({
          principalId: CourseActorId.from('reviewer-1'),
          role: CourseOwnershipRole.REVIEWER,
        }),
      );

      expect(course.ownership.size).toBe(3);
    });

    it('allows exactly one Owner through aggregate integration', () => {
      const course = createCourse();

      course.addOwnershipAssignment(createOwnerAssignment('owner-1'));

      expect(course.ownership.hasOwner()).toBe(true);
      expect(
        course.ownership.getForRole(CourseOwnershipRole.OWNER),
      ).toHaveLength(1);
    });

    it('rejects a duplicate principal/role assignment through the aggregate', () => {
      const course = createCourse();

      course.addOwnershipAssignment(createAuthorAssignment('author-1'));

      expect(() =>
        course.addOwnershipAssignment(createAuthorAssignment('author-1')),
      ).toThrow(CourseValidationError);

      expect(course.ownership.size).toBe(1);
    });

    it('rejects a second Owner through the aggregate', () => {
      const course = createCourse();

      course.addOwnershipAssignment(createOwnerAssignment('owner-1'));

      expect(() =>
        course.addOwnershipAssignment(createOwnerAssignment('owner-2')),
      ).toThrow(CourseValidationError);

      expect(course.ownership.size).toBe(1);
      expect(
        course.ownership
          .getOwner()
          ?.principalId.equals(CourseActorId.from('owner-1')),
      ).toBe(true);
    });

    it('removes an ownership assignment through the aggregate', () => {
      const course = createCourse();

      course.addOwnershipAssignment(createAuthorAssignment('author-1'));

      course.addOwnershipAssignment(createAuthorAssignment('author-2'));

      course.removeOwnershipAssignment(
        CourseActorId.from('author-1'),
        CourseOwnershipRole.AUTHOR,
      );

      expect(course.ownership.size).toBe(1);
      expect(
        course.ownership.has(
          CourseActorId.from('author-1'),
          CourseOwnershipRole.AUTHOR,
        ),
      ).toBe(false);
      expect(
        course.ownership.has(
          CourseActorId.from('author-2'),
          CourseOwnershipRole.AUTHOR,
        ),
      ).toBe(true);
    });

    it('treats removal of a missing assignment as an aggregate no-op', () => {
      const course = createCourse();

      const previousUpdatedAt = course.updatedAt;

      course.removeOwnershipAssignment(
        CourseActorId.from('missing-actor'),
        CourseOwnershipRole.AUTHOR,
      );

      expect(course.ownership.size).toBe(0);
      expect(course.updatedAt.getTime()).toBeGreaterThanOrEqual(
        previousUpdatedAt.getTime(),
      );
    });

    it('does not mutate ownership when an invalid add is rejected', () => {
      const course = createCourse();

      course.addOwnershipAssignment(createAuthorAssignment('author-1'));

      expect(() =>
        course.addOwnershipAssignment(createAuthorAssignment('author-1')),
      ).toThrow(CourseValidationError);

      expect(course.ownership.size).toBe(1);
      expect(
        course.ownership.has(
          CourseActorId.from('author-1'),
          CourseOwnershipRole.AUTHOR,
        ),
      ).toBe(true);
    });

    it('replaces ownership only when the supplied collection differs', () => {
      const course = createCourse();
      const ownership = CourseOwnership.create([
        createAuthorAssignment('author-1'),
      ]);

      const previousUpdatedAt = course.updatedAt;

      course.replaceOwnership(ownership);

      expect(course.ownership.equals(ownership)).toBe(true);
      expect(course.updatedAt.getTime()).toBeGreaterThanOrEqual(
        previousUpdatedAt.getTime(),
      );
    });

    it('does not change aggregate state when replacing with equivalent ownership', () => {
      const ownership = CourseOwnership.create([
        createAuthorAssignment('author-1'),
      ]);

      const course = Course.create({
        title: 'Equivalent Ownership Course',
        level: CourseLevel.BEGINNER,
        type: CourseType.SELF_PACED,
        instructorId: 'instructor-123',
        ownership,
      });

      const previousUpdatedAt = course.updatedAt;

      course.replaceOwnership(
        CourseOwnership.create([createAuthorAssignment('author-1')]),
      );

      expect(course.ownership.equals(ownership)).toBe(true);
      expect(course.updatedAt.getTime()).toBe(previousUpdatedAt.getTime());
    });

    it('rejects a non-CourseOwnership replacement', () => {
      const course = createCourse();

      expect(() => course.replaceOwnership({} as CourseOwnership)).toThrow(
        CourseValidationError,
      );
    });

    it('does not emit a new domain event for ownership mutation', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.addOwnershipAssignment(createAuthorAssignment('author-1'));

      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('preserves ownership across domain rehydration when supplied explicitly', () => {
      const originalOwnership = CourseOwnership.create([
        createOwnerAssignment('owner-1'),
        createAuthorAssignment('author-1'),
      ]);

      const original = Course.create({
        title: 'Rehydration Course',
        level: CourseLevel.BEGINNER,
        type: CourseType.SELF_PACED,
        instructorId: 'instructor-123',
        ownership: originalOwnership,
      });

      const rehydrated = Course.rehydrate(
        original.toPrimitives(),
        original.ownership,
      );

      expect(rehydrated.id.equals(original.id)).toBe(true);
      expect(rehydrated.ownership.equals(original.ownership)).toBe(true);
      expect(rehydrated.getDomainEvents()).toHaveLength(0);
    });

    it('keeps the existing persistence primitive contract unchanged', () => {
      const course = Course.create({
        title: 'Persistence Compatibility Course',
        level: CourseLevel.BEGINNER,
        type: CourseType.SELF_PACED,
        instructorId: 'instructor-123',
        ownership: CourseOwnership.create([createOwnerAssignment('owner-1')]),
      });

      const primitives = course.toPrimitives();

      expect(primitives.instructorId).toBe('instructor-123');
      expect(primitives.id).toBe(course.id);
      expect(primitives.title).toBe(course.title);
      expect(primitives.status).toBe(course.status);
      expect(
        Object.prototype.hasOwnProperty.call(primitives, 'ownership'),
      ).toBe(false);
    });
  });

  describe('metadata updates', () => {
    it('updates metadata while the Course is in DRAFT', () => {
      const course = createCourse();
      const previousUpdatedAt = course.updatedAt;

      course.updateMetadata({
        title: 'Advanced TypeScript Fundamentals',
        description: 'Updated description.',
        level: CourseLevel.INTERMEDIATE,
        type: CourseType.BLENDED,
        visibility: CourseVisibility.PUBLIC,
      });

      expect(course.title).toBe('Advanced TypeScript Fundamentals');
      expect(course.description).toBe('Updated description.');
      expect(course.level).toBe(CourseLevel.INTERMEDIATE);
      expect(course.type).toBe(CourseType.BLENDED);
      expect(course.visibility).toBe(CourseVisibility.PUBLIC);
      expect(course.updatedAt.getTime()).toBeGreaterThanOrEqual(
        previousUpdatedAt.getTime(),
      );
    });

    it('records CourseMetadataUpdated after a successful update', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.updateMetadata({
        title: 'Updated Course',
      });

      const [event] = course.getDomainEvents();

      expect(event?.eventName).toBe(CourseDomainEventName.METADATA_UPDATED);
    });

    it('allows updating only a subset of metadata', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'New Title',
      });

      expect(course.title).toBe('New Title');
      expect(course.description).toBe('Learn TypeScript from the ground up.');
      expect(course.level).toBe(CourseLevel.BEGINNER);
      expect(course.type).toBe(CourseType.SELF_PACED);
    });

    it('rejects metadata updates after submission for review', () => {
      const course = createCourse();

      course.submitForReview();

      expect(() =>
        course.updateMetadata({
          title: 'Should Not Change',
        }),
      ).toThrow(CourseValidationError);
    });
  });

  describe('lifecycle', () => {
    it('transitions DRAFT to IN_REVIEW', () => {
      const course = createCourse();

      course.submitForReview();

      expect(course.status).toBe(CourseStatus.IN_REVIEW);
    });

    it('transitions IN_REVIEW to PUBLISHED', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
    });

    it('transitions PUBLISHED to UNPUBLISHED', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();
      course.unpublish();

      expect(course.status).toBe(CourseStatus.UNPUBLISHED);
    });

    it('transitions PUBLISHED to ARCHIVED', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();
      course.archive();

      expect(course.status).toBe(CourseStatus.ARCHIVED);
    });

    it('transitions UNPUBLISHED to ARCHIVED', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      expect(course.status).toBe(CourseStatus.ARCHIVED);
    });

    it('rejects submitting an archived Course for review', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();
      course.archive();

      expect(() => course.submitForReview()).toThrow(
        InvalidCourseStateTransitionError,
      );
    });

    it('rejects publishing a DRAFT Course', () => {
      const course = createCourse();

      expect(() => course.publish()).toThrow(InvalidCourseStateTransitionError);
    });

    it('rejects unpublishing a DRAFT Course', () => {
      const course = createCourse();

      expect(() => course.unpublish()).toThrow(
        InvalidCourseStateTransitionError,
      );
    });

    it('rejects archiving a DRAFT Course', () => {
      const course = createCourse();

      expect(() => course.archive()).toThrow(InvalidCourseStateTransitionError);
    });

    it('rejects re-archiving an archived Course', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();
      course.archive();

      expect(() => course.archive()).toThrow(InvalidCourseStateTransitionError);
    });
  });

  describe('serialization', () => {
    it('returns a detached primitive representation', () => {
      const course = createCourse();
      const primitives = course.toPrimitives();

      expect(primitives.id).toBe(course.id);
      expect(primitives.title).toBe(course.title);
      expect(primitives.status).toBe(course.status);

      expect(primitives.createdAt).not.toBe(course.createdAt);
      expect(primitives.updatedAt).not.toBe(course.updatedAt);
    });
  });

  describe('rehydration', () => {
    it('rehydrates a Course without generating a new identity', () => {
      const course = createCourse();

      const rehydrated = Course.rehydrate(course.toPrimitives());

      expect(rehydrated.id.equals(course.id)).toBe(true);
      expect(rehydrated.title).toBe(course.title);
      expect(rehydrated.status).toBe(course.status);
    });

    it('does not generate a domain event during rehydration', () => {
      const course = createCourse();

      const rehydrated = Course.rehydrate(course.toPrimitives());

      expect(rehydrated.getDomainEvents()).toHaveLength(0);
    });

    it('rehydrates with an explicitly supplied ownership state', () => {
      const course = createCourse();

      const ownership = CourseOwnership.create([
        createOwnerAssignment('owner-1'),
      ]);

      const rehydrated = Course.rehydrate(course.toPrimitives(), ownership);

      expect(rehydrated.ownership.equals(ownership)).toBe(true);
      expect(rehydrated.getDomainEvents()).toHaveLength(0);
    });
  });
});
